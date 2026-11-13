'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  BriefcaseMedical,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  canonicalDegree,
  evaluateRequirements,
  isOnboardingSectionComplete,
  onboardingSectionForRequirement,
  onboardingSections,
  type OnboardingSection,
} from '@/lib/requirements';
import { isValidNpi } from '@/lib/npi';
import { DEMO_DATA_MODE, demoNpis } from '@/lib/demo-data';
import { detectCareerGaps, monthYear } from '@/lib/career';
import { acquisitionImpact, nextBestAction } from '@/lib/acquisition-insights';
import { organizationName } from '@/lib/field-mappings';
import { conflictsFromLookup } from '@/lib/acquisition';
import {
  historiesFor,
  normalizePractitioner,
  organizations,
  pendingOrganizationIds,
  submittedOrganizationIds,
  type AccountState,
  type AffiliationHistory,
  type CaseStatus,
  type CareerEntry,
  type ExtractedCandidate,
  type ManagedPractitioner,
  type PracticeHistory,
  type PractitionerLookup,
  type ProviderHistories,
} from '@/lib/domain';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { createIncrementalSubmission } from '@/lib/submissions';

const emptyAccount: AccountState = {
  authenticated: false,
  user: null,
  practitioners: [],
  notifications: [],
};
function normalizeAccount(account: AccountState): AccountState {
  return {
    ...account,
    practitioners: account.practitioners.map(normalizePractitioner),
  };
}
const blankProfile = {
  degree: '',
  licenseState: '',
  licenseNumber: '',
  practiceAddress: '',
  education: '',
  graduationYear: '',
  malpracticeCarrier: '',
  hospitalAffiliation: '',
  disclosure: '',
};
const caseLabels: Record<CaseStatus, string> = {
  submitted: 'Application submitted',
  intake_review: 'Intake review (Simulation)',
  information_requested: 'Action required',
  verification: 'Verification in progress (Simulation)',
  credentialing_review: 'Credentialing review (Simulation)',
  approved: 'Approved (Simulation)',
  denied: 'Denied (Simulation)',
};
const degreeOptions = [
  'MD',
  'DO',
  'NP',
  'PA-C',
  'DPM',
  'DDS',
  'DMD',
  'PhD',
  'PsyD',
];
const stateOptions = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];
const yearOptions = Array.from({ length: 61 }, (_, i) =>
  String(new Date().getFullYear() - i),
);
const carriers = [
  'The Doctors Company',
  'MedPro Group',
  'Coverys',
  'ProAssurance',
  'Medical Mutual',
  'Other / Not listed',
];
const hospitals = [
  'Northstar Community Hospital',
  'Evergreen Regional Medical Center',
  'Horizon Memorial Hospital',
  'Independent / No affiliation',
  'Other / Not listed',
];
type Navigate = (
  view: string,
  id?: string,
  section?: OnboardingSection,
) => void;
const onboardingSectionNames = new Set<OnboardingSection>([
  'Resolve conflicts',
  'Professional details',
  'Education',
  'License',
  'Practice',
  'Documents',
  'Affiliations',
  'Coverage',
  'Disclosures',
]);
function parseOnboardingSection(value: string | null) {
  return value && onboardingSectionNames.has(value as OnboardingSection)
    ? (value as OnboardingSection)
    : undefined;
}
const uid = () => crypto.randomUUID(),
  now = () => new Date().toISOString();
function pathFor(view: string, id?: string, section?: OnboardingSection) {
  if (view === 'login' || view === 'signup') return `/${view}`;
  if (view === 'new') return '/practitioners/new';
  if (view === 'dashboard') return '/dashboard';
  if (id) {
    const path = `/practitioners/${id}${view === 'overview' ? '' : `/${view}`}`;
    return view === 'onboarding' && section
      ? `${path}?section=${encodeURIComponent(section)}`
      : path;
  }
  return '/dashboard';
}
function parsePath() {
  const parts = location.pathname.split('/').filter(Boolean);
  const section = parseOnboardingSection(
    new URLSearchParams(location.search).get('section'),
  );
  if (parts[0] === 'login' || parts[0] === 'signup')
    return { view: parts[0], id: '' };
  if (parts[0] === 'practitioners' && parts[1] === 'new')
    return { view: 'new', id: '' };
  if (parts[0] === 'practitioners' && parts[1])
    return { view: parts[2] || 'overview', id: parts[1], section };
  return { view: 'dashboard', id: '' };
}

export default function CertifyOSApp() {
  const [account, setAccount] = useState<AccountState>(emptyAccount),
    [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
      null,
    ),
    [configurationError, setConfigurationError] = useState(false),
    [ready, setReady] = useState(false),
    [workspaceLoaded, setWorkspaceLoaded] = useState(false),
    [route, setRoute] = useState<{
      view: string;
      id: string;
      section?: OnboardingSection;
    }>({ view: 'dashboard', id: '' }),
    [toast, setToast] = useState('');
  useEffect(() => {
    let active = true;
    const current = parsePath();
    setRoute(current);
    const pop = () => setRoute(parsePath());
    addEventListener('popstate', pop);
    if (!isSupabaseConfigured()) {
      setConfigurationError(true);
      setWorkspaceLoaded(true);
      setReady(true);
      return () => removeEventListener('popstate', pop);
    }
    const client = createClient();
    setSupabase(client);
    void (async () => {
      const { data } = await client.auth.getUser();
      if (!active) return;
      if (data.user) {
        const response = await fetch('/api/workspace', { cache: 'no-store' });
        if (response.ok) {
          const saved = (await response.json()) as AccountState;
          if (active)
            setAccount(normalizeAccount({ ...saved, authenticated: true }));
        } else if (active)
          setAccount({
            authenticated: true,
            user: {
              fullName:
                data.user.user_metadata.full_name ??
                data.user.email?.split('@')[0] ??
                'Provider',
              email: data.user.email ?? '',
            },
            practitioners: [],
            notifications: [],
          });
        if (['login', 'signup'].includes(current.view)) {
          history.replaceState({}, '', '/dashboard');
          setRoute({ view: 'dashboard', id: '' });
        }
      }
      if (active) {
        setWorkspaceLoaded(true);
        setReady(true);
      }
    })();
    return () => {
      active = false;
      removeEventListener('popstate', pop);
    };
  }, []);
  useEffect(() => {
    if (!workspaceLoaded || !account.authenticated) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error('save failed');
        })
        .catch((error) => {
          if (error.name !== 'AbortError')
            setToast('We couldn’t save the latest change. Please retry.');
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [workspaceLoaded, account]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function go(view: string, id = '', section?: OnboardingSection) {
    const path = pathFor(view, id, section);
    history.pushState({}, '', path);
    setRoute({ view, id, section });
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  function savePractitioner(next: ManagedPractitioner) {
    setAccount((a) => ({
      ...a,
      practitioners: a.practitioners.map((p) => (p.id === next.id ? next : p)),
    }));
  }
  async function deletePractitioner(practitioner: ManagedPractitioner) {
    const response = await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practitionerId: practitioner.id,
        paths: practitioner.documents
          .map((document) => document.storagePath)
          .filter((path): path is string => Boolean(path)),
      }),
    });
    if (!response.ok) {
      setToast('We couldn’t delete this practitioner. Please retry.');
      return false;
    }
    setAccount((current) => ({
      ...current,
      practitioners: current.practitioners.filter(
        (item) => item.id !== practitioner.id,
      ),
    }));
    setToast('Practitioner deleted from your workspace.');
    return true;
  }
  async function authenticate(
    mode: string,
    fullName: string,
    email: string,
    password: string,
  ) {
    if (!supabase) return 'Supabase is not configured for this deployment yet.';
    if (mode === 'signup') {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });
      if (!signupResponse.ok) {
        const body = (await signupResponse.json()) as { error?: string };
        return body.error ?? 'Unable to create your account.';
      }
    }
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return result.error.message;
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    const saved = response.ok
      ? ((await response.json()) as AccountState)
      : { ...emptyAccount, authenticated: true, user: { fullName, email } };
    setAccount(
      normalizeAccount({
        ...saved,
        authenticated: true,
        user: { fullName: saved.user?.fullName ?? fullName, email },
      }),
    );
    setWorkspaceLoaded(true);
    go(saved.practitioners.length ? 'dashboard' : 'new');
    setToast('Welcome to your CertifyOS workspace.');
    return null;
  }
  const practitioner = account.practitioners.find((p) => p.id === route.id);
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center">
        <LoaderCircle className="loading-spinner text-[var(--teal)]" />
      </div>
    );
  if (configurationError)
    return (
      <main className="auth-page">
        <section className="auth-brand">
          <span className="brand-large">
            <ShieldCheck />
          </span>
          <p>CertifyOS</p>
          <h1>Deployment configuration required.</h1>
          <p>
            The application was deployed successfully, but its Supabase public
            environment variables have not been added to this environment.
          </p>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <p className="eyebrow">Administrator action required</p>
            <h2>Connect this deployment to Supabase</h2>
            <p className="description">
              Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel Environment
              Variables, then redeploy.
            </p>
          </div>
        </section>
      </main>
    );
  if (
    !account.authenticated ||
    route.view === 'login' ||
    route.view === 'signup'
  )
    return (
      <Auth
        mode={route.view === 'signup' ? 'signup' : 'login'}
        authenticate={authenticate}
        go={go}
      />
    );
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {toast && <Toast text={toast} close={() => setToast('')} />}
      <Header
        account={account}
        go={go}
        logout={async () => {
          await supabase?.auth.signOut();
          setWorkspaceLoaded(false);
          setAccount(emptyAccount);
          go('login');
        }}
      />
      <div className="app-shell">
        {route.view === 'dashboard' && (
          <Dashboard
            account={account}
            go={go}
            deletePractitioner={deletePractitioner}
          />
        )}{' '}
        {route.view === 'new' && (
          <PractitionerWizard
            account={account}
            setAccount={setAccount}
            go={go}
            notify={setToast}
          />
        )}{' '}
        {practitioner && !['dashboard', 'new'].includes(route.view) && (
          <Workspace
            practitioner={practitioner}
            view={route.view}
            onboardingSection={route.section}
            save={savePractitioner}
            go={go}
            notify={setToast}
          />
        )}
      </div>
    </main>
  );
}
function Auth({
  mode,
  authenticate,
  go,
}: {
  mode: string;
  authenticate: (
    m: string,
    n: string,
    e: string,
    p: string,
  ) => Promise<string | null>;
  go: (v: string) => void;
}) {
  const signup = mode === 'signup',
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const message = await authenticate(
      mode,
      name || 'Provider',
      email,
      password,
    );
    if (message) setError(message);
    setBusy(false);
  }
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-logo-lockup">
            <span className="brand-large">
              <ShieldCheck />
            </span>
            <span>
              <b>CertifyOS</b>
              <small>Provider Credentialing</small>
            </span>
          </div>
          <div className="auth-promise">
            <p className="eyebrow">Built for providers</p>
            <h1>Credentialing without the paperwork maze.</h1>
            <p>
              One guided profile, clear next steps, and every application in a
              single calm workspace.
            </p>
          </div>
          <div className="auth-journey">
            <div>
              <span>
                <Search size={17} />
              </span>
              <b>Find your record</b>
              <small>Start with only an NPI</small>
            </div>
            <i />
            <div>
              <span>
                <Sparkles size={17} />
              </span>
              <b>Complete what’s missing</b>
              <small>We prefill what we can</small>
            </div>
            <i />
            <div>
              <span>
                <CheckCircle2 size={17} />
              </span>
              <b>Review and submit</b>
              <small>One clear final check</small>
            </div>
          </div>
          <div className="auth-trust-row">
            <ShieldCheck size={16} />
            <span>
              <b>Private by design</b>
              <small>Your progress saves securely as you go.</small>
            </span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-mobile auth-logo-lockup">
            <span className="brand">
              <ShieldCheck size={19} />
            </span>
            <span>
              <b>CertifyOS</b>
              <small>Provider Credentialing</small>
            </span>
          </div>
          <div className="auth-card-head">
            <span className="beta-pill">Provider beta</span>
            <p className="eyebrow">
              {signup ? 'Create your account' : 'Welcome back'}
            </p>
            <h2>
              {signup
                ? 'Your easier application starts here'
                : 'Continue where you left off'}
            </h2>
            <p>
              {signup
                ? 'No email verification. Create your account and begin with an NPI.'
                : 'Sign in to continue your saved applications and credentialing progress.'}
            </p>
          </div>
          <form onSubmit={submit}>
            {signup && (
              <Field label="Full name">
                <input
                  className="input auth-input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your full legal name"
                  required
                />
              </Field>
            )}
            <Field label="Email">
              <input
                className="input auth-input w-full"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className="input auth-input w-full"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={
                  signup ? 'At least 8 characters' : 'Enter your password'
                }
                minLength={8}
                required
              />
              {signup && (
                <small className="password-hint">
                  <ShieldCheck size={13} /> Use 8 or more characters
                </small>
              )}
            </Field>
            {error && (
              <div className="error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button
              className="primary-button auth-submit w-full"
              type="submit"
              disabled={busy}
            >
              {busy && <LoaderCircle size={14} className="loading-spinner" />}
              {signup ? 'Create my account' : 'Sign in securely'}
              <ArrowRight size={14} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to CertifyOS?'}{' '}
            <button onClick={() => go(signup ? 'login' : 'signup')}>
              {signup ? 'Sign in' : 'Create account'}
            </button>
          </p>
          <p className="demo-note">
            <CheckCircle2 size={14} /> Your progress is saved automatically.
          </p>
        </div>
      </section>
    </main>
  );
}

function Header({
  account,
  go,
  logout,
}: {
  account: AccountState;
  go: Navigate;
  logout: () => void | Promise<void>;
}) {
  return (
    <header className="app-header">
      <div className="header-shell">
        <button className="logo" onClick={() => go('dashboard')}>
          <span className="brand">
            <ShieldCheck size={19} />
          </span>
          <span>
            <b>CertifyOS</b>
            <small>Provider Portal</small>
          </span>
        </button>
        <nav>
          <button onClick={() => go('dashboard')}>
            <UsersRound size={15} />
            Practitioners
          </button>
          <button className="add-button" onClick={() => go('new')}>
            <Plus size={14} />
            Add Practitioner
          </button>
          <button className="icon-button" aria-label="Notifications">
            <Bell size={17} />
            {account.notifications.length > 0 && <i />}
          </button>
          <span className="avatar">
            {account.user?.fullName
              .split(' ')
              .map((x) => x[0])
              .slice(0, 2)
              .join('')}
          </span>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function Dashboard({
  account,
  go,
  deletePractitioner,
}: {
  account: AccountState;
  go: (v: string, id?: string) => void;
  deletePractitioner: (p: ManagedPractitioner) => Promise<boolean>;
}) {
  const [q, setQ] = useState(''),
    [filter, setFilter] = useState('all');
  const rows = account.practitioners
    .filter((p) =>
      `${p.practitioner?.firstName} ${p.practitioner?.lastName} ${p.practitioner?.npi}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .filter(
      (p) =>
        filter === 'all' ||
        (filter === 'action' &&
          p.cases.some((c) => c.status === 'information_requested')) ||
        (filter === 'in_progress' && pendingOrganizationIds(p).length > 0) ||
        (filter === 'credentialing' &&
          p.cases.some((c) => !['approved', 'denied'].includes(c.status))),
    );
  const action = account.practitioners.filter((p) =>
      p.cases.some((c) => c.status === 'information_requested'),
    ).length,
    inProgress = account.practitioners.filter(
      (p) => pendingOrganizationIds(p).length > 0,
    ).length,
    credentialing = account.practitioners.filter((p) =>
      p.cases.some((c) => !['approved', 'denied'].includes(c.status)),
    ).length;
  if (!account.practitioners.length)
    return (
      <div className="welcome-empty">
        <span>
          <Stethoscope />
        </span>
        <p className="eyebrow">Welcome to CertifyOS</p>
        <h1>Add your first practitioner</h1>
        <p>
          We’ll find available professional information and help you complete
          credentialing applications.
        </p>
        <button className="primary-button" onClick={() => go('new')}>
          <Plus size={15} />
          Add Practitioner
        </button>
      </div>
    );
  return (
    <>
      <PageTitle
        title="Practitioners"
        description="Manage practitioner applications and track credentialing progress."
        action={
          <button className="primary-button" onClick={() => go('new')}>
            <Plus size={14} />
            Add Practitioner
          </button>
        }
      />
      <div className="metrics">
        <Metric
          value={account.practitioners.length}
          label="Total practitioners"
          tone="navy"
          icon={<UserRoundCheck size={18} />}
          selected={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <Metric
          value={inProgress}
          label="Applications in progress"
          tone="amber"
          icon={<Clock3 size={18} />}
          selected={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
        />
        <Metric
          value={credentialing}
          label="Credentialing in progress"
          tone="blue"
          icon={<Activity size={18} />}
          selected={filter === 'credentialing'}
          onClick={() => setFilter('credentialing')}
        />
        <Metric
          value={action}
          label="Action required"
          tone="red"
          icon={<AlertCircle size={18} />}
          selected={filter === 'action'}
          onClick={() => setFilter('action')}
        />
      </div>
      <div className="directory surface">
        <div className="directory-tools">
          <label>
            <Search size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or NPI"
            />
          </label>
          <label>
            <Filter size={14} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All practitioners</option>
              <option value="action">Action required</option>
              <option value="in_progress">Application in progress</option>
              <option value="credentialing">Credentialing in progress</option>
            </select>
          </label>
        </div>
        <div className="practitioner-table">
          <div className="table-head">
            <span>Practitioner</span>
            <span>Organizations</span>
            <span>Application</span>
            <span>Credentialing</span>
            <span>Next action</span>
            <span className="actions-heading">Actions</span>
          </div>
          {rows.map((p) => (
            <PractitionerRow
              key={p.id}
              p={p}
              go={go}
              deletePractitioner={deletePractitioner}
            />
          ))}
          {!rows.length && (
            <div className="no-results">
              No practitioners match these filters.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Metric({
  value,
  label,
  tone,
  icon,
  selected,
  onClick,
}: {
  value: number;
  label: string;
  tone: 'navy' | 'blue' | 'amber' | 'red';
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`metric metric-${tone} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label}: ${value}. Filter dashboard`}
    >
      <span className="metric-icon">{icon}</span>
      <span className="metric-copy">
        <b>{value}</b>
        <span>{label}</span>
      </span>
    </button>
  );
}
function PractitionerRow({
  p,
  go,
  deletePractitioner,
}: {
  p: ManagedPractitioner;
  go: (v: string, id?: string) => void;
  deletePractitioner: (p: ManagedPractitioner) => Promise<boolean>;
}) {
  const pendingOrganizations = pendingOrganizationIds(p),
    req = evaluateRequirements(
      p,
      pendingOrganizations.length
        ? pendingOrganizations
        : p.selectedOrganizations,
    ),
    pct = req.length
      ? Math.round((req.filter((x) => x.satisfied).length / req.length) * 100)
      : 0,
    action = p.cases.some((c) => c.status === 'information_requested'),
    active = p.cases.some((c) => !['approved', 'denied'].includes(c.status));
  return (
    <div className="practitioner-row">
      <button
        type="button"
        className="practitioner-row-link"
        onClick={() => go('overview', p.id)}
      >
        <span className="person">
          <i>
            {p.practitioner?.firstName[0]}
            {p.practitioner?.lastName[0]}
          </i>
          <span>
            <b>
              {p.practitioner?.firstName} {p.practitioner?.lastName},{' '}
              {p.profile.degree || p.practitioner?.credential}
            </b>
            <small>NPI {p.practitioner?.npi}</small>
          </span>
        </span>
        <span>{p.selectedOrganizations.length}</span>
        <span>
          <Status
            text={
              pendingOrganizations.length
                ? pct === 100
                  ? 'Ready for review'
                  : `${pct}% complete`
                : p.submittedAt
                  ? 'Submitted'
                  : pct === 100
                    ? 'Ready for review'
                    : `${pct}% complete`
            }
            tone={!pendingOrganizations.length || pct === 100 ? 'green' : 'red'}
          />
        </span>
        <span>
          <Status
            text={
              action
                ? 'Action required'
                : active
                  ? 'In progress'
                  : p.cases.length
                    ? 'Complete (Simulation)'
                    : 'Not started'
            }
            tone={action ? 'red' : active ? 'blue' : 'neutral'}
          />
        </span>
        <span className="next">
          {action
            ? 'Upload document'
            : pendingOrganizations.length
              ? 'Continue'
              : p.submittedAt
                ? 'View status'
                : 'Continue'}
          <ChevronRight size={14} />
        </span>
      </button>
      <DeletePractitionerDialog
        practitioner={p}
        onDelete={deletePractitioner}
      />
    </div>
  );
}

function DeletePractitionerDialog({
  practitioner,
  onDelete,
}: {
  practitioner: ManagedPractitioner;
  onDelete: (p: ManagedPractitioner) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    name =
      `${practitioner.practitioner?.firstName ?? ''} ${practitioner.practitioner?.lastName ?? ''}`.trim();
  async function remove() {
    setBusy(true);
    if (await onDelete(practitioner)) setOpen(false);
    setBusy(false);
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            className="row-delete-button"
            aria-label={`Delete ${name}`}
            title={`Delete ${name}`}
          />
        }
      >
        <Trash2 size={16} />
      </AlertDialogTrigger>
      <AlertDialogContent className="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogMedia className="delete-dialog-icon">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the practitioner, application progress,
            credentialing cases, and uploaded documents from this workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            Keep practitioner
          </AlertDialogCancel>
          <AlertDialogAction
            className="danger-confirm"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy && <LoaderCircle size={14} className="loading-spinner" />}
            Delete practitioner
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PractitionerWizard({
  account,
  setAccount,
  go,
  notify,
}: {
  account: AccountState;
  setAccount: React.Dispatch<React.SetStateAction<AccountState>>;
  go: Navigate;
  notify: (s: string) => void;
}) {
  const [step, setStep] = useState(1),
    [npi, setNpi] = useState(''),
    [lookup, setLookup] = useState<PractitionerLookup>(),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(''),
    [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [email, setEmail] = useState(''),
    [caqh, setCaqh] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [manualAvailable, setManualAvailable] = useState(false);

  async function validateNpi() {
    setError('');
    if (!/^\d{10}$/.test(npi) || (!DEMO_DATA_MODE && !isValidNpi(npi))) {
      setError('Enter a valid 10-digit individual NPI.');
      return;
    }
    if (account.practitioners.some((p) => p.practitioner?.npi === npi)) {
      setError('This practitioner is already in your workspace.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/npi/${npi}`);
      const body = (await response.json()) as
        | PractitionerLookup
        | { error: string; kind?: string };
      if (!response.ok || 'error' in body) {
        if ('kind' in body && body.kind === 'no_demo_match')
          setManualAvailable(true);
        throw new Error('error' in body ? body.error : 'Lookup failed');
      }
      setManualAvailable(false);
      setLookup(body);
      setFirst(body.firstName);
      setLast(body.lastName);
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }

  function beginManualEntry() {
    const retrievedAt = now();
    setLookup({
      npi,
      firstName: '',
      lastName: '',
      deactivated: false,
      demoScenario: 'manual',
      addresses: [],
      taxonomies: [],
      nppes: {
        source: 'Manual entry',
        status: 'not_found',
        live: false,
        classification: 'practitioner_asserted',
        retrievedAt,
        reference: 'No demonstration record available',
        facts: { factCount: 0 },
        warning: 'No public or simulated identity match was created.',
      },
      cms: {
        source: 'Manual entry',
        status: 'not_found',
        live: false,
        classification: 'practitioner_asserted',
        retrievedAt,
        reference: 'No demonstration record available',
        facts: { rows: [] },
      },
    });
    setFirst('');
    setLast('');
    setError('');
    setStep(2);
  }

  function createPractitioner() {
    if (!lookup || !email) {
      setError('Add a contact email before continuing.');
      setStep(2);
      return;
    }
    if (!selected.length) {
      setError('Select at least one organization.');
      return;
    }
    setError('');
    setCreating(true);
    const location = lookup.addresses.find((a) => a.purpose === 'LOCATION'),
      cms = lookup.cms.facts.rows[0],
      id = uid(),
      profile: ManagedPractitioner['profile'] = {
        ...blankProfile,
        degree: canonicalDegree(lookup.credential ?? '') ?? '',
        licenseState:
          lookup.taxonomies.find((taxonomy) => taxonomy.primary)?.state ?? '',
        licenseNumber:
          lookup.taxonomies.find((taxonomy) => taxonomy.primary)?.license ?? '',
        practiceAddress: location
          ? `${location.line1}, ${location.city}, ${location.state} ${location.postalCode}`
          : '',
        education: cms?.medicalSchool ?? '',
        graduationYear: cms?.graduationYear ?? '',
      },
      histories: ProviderHistories = {
        education:
          profile.education || profile.graduationYear
            ? [
                {
                  id: uid(),
                  institution: profile.education,
                  degree: profile.degree,
                  graduationYear: profile.graduationYear,
                },
              ]
            : [],
        licenses: lookup.taxonomies
          .filter((taxonomy) => taxonomy.state || taxonomy.license)
          .map((taxonomy) => ({
            id: uid(),
            state: taxonomy.state ?? '',
            licenseNumber: taxonomy.license ?? '',
            licenseType: profile.degree,
            expirationDate: '',
          })),
        practices: profile.practiceAddress
          ? [
              {
                id: uid(),
                organization: cms?.name ?? '',
                address: profile.practiceAddress,
                startYear: '',
                endYear: '',
                current: true,
              },
            ]
          : [],
        affiliations: Array.from(
          new Set(lookup.cms.facts.rows.map((row) => row.name).filter(Boolean)),
        ).map((hospital) => ({
          id: uid(),
          hospital: hospital ?? '',
          startYear: '',
          endYear: '',
          current: true,
        })),
      },
      dataConflicts = conflictsFromLookup(lookup),
      importedFacts = [
        ['identity.npi', lookup.npi],
        ['identity.name', `${first} ${last}`.trim()],
        ['professional.degree', profile.degree],
        ['license.active', profile.licenseNumber],
        ['practice.primary_address', profile.practiceAddress],
        ['education.medical_school', profile.education],
      ].filter((item) => item[1]),
      practitioner: ManagedPractitioner = {
        id,
        role: 'provider',
        practitioner: { ...lookup, firstName: first, lastName: last },
        contactEmail: email,
        caqhId: caqh,
        selectedOrganizations: selected,
        profile,
        histories,
        dataConflicts,
        extractedCandidates: [],
        careerTimeline: [],
        careerGaps: [],
        factProvenance: importedFacts.map(([canonicalKey, value]) => ({
          id: uid(),
          canonicalKey,
          value,
          source:
            lookup.demoScenario === 'manual'
              ? 'Practitioner manual entry'
              : lookup.nppes.source,
          classification:
            lookup.demoScenario === 'manual' ? 'manual_entry' : 'demo_imported',
          recordedAt: now(),
        })),
        acquisitionEvents: [
          {
            id: uid(),
            type:
              lookup.demoScenario === 'manual' ? 'manual_entry' : 'demo_import',
            canonicalKeys: importedFacts.map(([canonicalKey]) => canonicalKey),
            source:
              lookup.demoScenario === 'manual'
                ? 'Practitioner manual entry'
                : lookup.nppes.source,
            occurredAt: now(),
          },
        ],
        submissions: [],
        documents: [],
        attested: false,
        cases: [],
        audit: [
          {
            action:
              lookup.demoScenario === 'manual'
                ? 'Practitioner created with manual entry'
                : 'Practitioner created from fictional demonstration data',
            at: now(),
          },
        ],
        createdAt: now(),
        updatedAt: now(),
      };
    window.setTimeout(() => {
      setAccount((current) => ({
        ...current,
        practitioners: [...current.practitioners, practitioner],
      }));
      notify(
        'Profile ready. Review the prefilled information and missing items.',
      );
      go(
        'onboarding',
        id,
        dataConflicts.length ? 'Resolve conflicts' : undefined,
      );
    }, 3600);
  }

  const primaryTaxonomy = lookup?.taxonomies.find(
      (taxonomy) => taxonomy.primary,
    ),
    location = lookup?.addresses.find(
      (address) => address.purpose === 'LOCATION',
    );

  return (
    <div className="wizard-page">
      <button className="wizard-close" onClick={() => go('dashboard')}>
        <X size={18} />
        Cancel
      </button>
      <section className="wizard-modal" aria-labelledby="wizard-title">
        {creating ? (
          <output className="fetching-state">
            <div className="fetch-orbit">
              <ShieldCheck size={27} />
            </div>
            <p className="eyebrow">Building practitioner profile</p>
            <h1>Bringing the available data together</h1>
            <p>
              We’re matching the NPI record, organizing public facts, and
              preparing the selected organization requirements.
            </p>
            <div className="fetch-stages">
              <span>
                <Check size={14} /> NPI validated
              </span>
              <span>
                <LoaderCircle size={14} className="loading-spinner" /> Matching
                sources
              </span>
              <span>Preparing missing items</span>
            </div>
          </output>
        ) : (
          <>
            <header className="wizard-header">
              <div>
                <p className="eyebrow">Add practitioner</p>
                <h1 id="wizard-title">
                  {step === 1 && 'Start with an NPI'}
                  {step === 2 && 'Confirm practitioner details'}
                  {step === 3 && 'Choose organizations'}
                </h1>
                <p>
                  {step === 1 &&
                    'We’ll use the NPI to prefill information that is already available.'}
                  {step === 2 &&
                    'Review the matched record and add the contact details for this workspace.'}
                  {step === 3 &&
                    'Select where this practitioner will complete credentialing applications.'}
                </p>
              </div>
              <span className="step-count">Step {step} of 3</span>
            </header>
            <div className="wizard-progress" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((item) => (
                <i key={item} className={item <= step ? 'active' : ''} />
              ))}
            </div>

            {step === 1 && (
              <div className="wizard-body npi-step">
                <label className="large-field">
                  <span>National Provider Identifier</span>
                  <input
                    inputMode="numeric"
                    value={npi}
                    onChange={(event) =>
                      setNpi(event.target.value.replace(/\D/g, ''))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void validateNpi();
                    }}
                    maxLength={10}
                    placeholder="Enter 10-digit NPI"
                    aria-describedby="npi-help"
                  />
                </label>
                <p id="npi-help" className="field-help">
                  For this prototype, try example NPI{' '}
                  <button onClick={() => setNpi(demoNpis.maya)}>
                    {demoNpis.maya}
                  </button>
                  . Simulated records are clearly labeled and no healthcare API
                  is called in demo mode.
                </p>
                {error && (
                  <div className="error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                {manualAvailable && (
                  <button
                    type="button"
                    className="manual-fallback"
                    onClick={beginManualEntry}
                  >
                    Continue with manual entry
                    <ArrowRight size={14} />
                  </button>
                )}
                <div className="wizard-actions end">
                  <button
                    className="primary-button roomy"
                    onClick={() => void validateNpi()}
                    disabled={busy || npi.length !== 10}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="loading-spinner" />
                    ) : (
                      <Search size={16} />
                    )}
                    Validate NPI
                  </button>
                </div>
              </div>
            )}

            {step === 2 && lookup && (
              <div className="wizard-body">
                <div className="verified-profile">
                  <span>
                    <CheckCircle2 size={20} />
                  </span>
                  <div>
                    <small>
                      {lookup.demoScenario === 'manual'
                        ? 'Manual practitioner record'
                        : 'Fictional demonstration record matched'}
                    </small>
                    <h2>
                      {lookup.firstName || 'New'}{' '}
                      {lookup.lastName || 'practitioner'}
                      {lookup.credential ? `, ${lookup.credential}` : ''}
                    </h2>
                    <p>
                      {primaryTaxonomy?.description ?? 'Specialty unavailable'}
                      {location ? ` · ${location.city}, ${location.state}` : ''}
                    </p>
                  </div>
                  <b>NPI {lookup.npi}</b>
                </div>
                <div className="wizard-form-grid">
                  <Field label="First name">
                    <input
                      className="input w-full"
                      value={first}
                      onChange={(e) => setFirst(e.target.value)}
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      className="input w-full"
                      value={last}
                      onChange={(e) => setLast(e.target.value)}
                    />
                  </Field>
                  <Field label="Contact email">
                    <input
                      className="input w-full"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="provider@example.com"
                    />
                  </Field>
                  <Field label="CAQH ID (optional)">
                    <input
                      className="input w-full"
                      value={caqh}
                      onChange={(e) => setCaqh(e.target.value)}
                      placeholder="Enter if available"
                    />
                  </Field>
                </div>
                {error && (
                  <div className="error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                <div className="wizard-actions">
                  <button
                    className="secondary-button roomy"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="primary-button roomy"
                    onClick={() =>
                      email
                        ? setStep(3)
                        : setError('Add a contact email before continuing.')
                    }
                  >
                    Next: Organizations <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="wizard-body">
                <div className="organization-choice-grid">
                  {organizations.map((organization) => {
                    const active = selected.includes(organization.id);
                    return (
                      <button
                        key={organization.id}
                        className={active ? 'selected' : ''}
                        onClick={() =>
                          setSelected((current) =>
                            active
                              ? current.filter((id) => id !== organization.id)
                              : [...current, organization.id],
                          )
                        }
                      >
                        <span className="org-icon">
                          <Building2 size={19} />
                        </span>
                        <span>
                          <b>{organization.name}</b>
                          <small>{organization.subtitle}</small>
                        </span>
                        <i>{active && <Check size={13} />}</i>
                      </button>
                    );
                  })}
                </div>
                {error && (
                  <div className="error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                <div className="wizard-actions">
                  <button
                    className="secondary-button roomy"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    className="primary-button roomy"
                    onClick={createPractitioner}
                    disabled={!selected.length}
                  >
                    Create Practitioner <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Workspace({
  practitioner: p,
  view,
  onboardingSection,
  save,
  go,
  notify,
}: {
  practitioner: ManagedPractitioner;
  view: string;
  onboardingSection?: OnboardingSection;
  save: (p: ManagedPractitioner) => void;
  go: Navigate;
  notify: (s: string) => void;
}) {
  const [recentlyAddedOrg, setRecentlyAddedOrg] = useState('');
  const pendingOrganizations = pendingOrganizationIds(p),
    submittedOrganizations = submittedOrganizationIds(p),
    requirementOrganizations = pendingOrganizations.length
      ? pendingOrganizations
      : p.selectedOrganizations,
    reqs = evaluateRequirements(p, requirementOrganizations),
    missing = reqs.filter((r) => !r.satisfied),
    pct = reqs.length
      ? Math.round(((reqs.length - missing.length) / reqs.length) * 100)
      : 0;
  function updateProfile(
    key: keyof ManagedPractitioner['profile'],
    value: string,
  ) {
    const recordedAt = now(),
      canonicalKey =
        (
          {
            degree: 'professional.degree',
            licenseState: 'license.state',
            licenseNumber: 'license.active',
            practiceAddress: 'practice.primary_address',
            education: 'education.medical_school',
            graduationYear: 'education.graduation_year',
            malpracticeCarrier: 'coverage.malpractice',
            hospitalAffiliation: 'affiliation.hospital',
            disclosure: 'disclosure.evergreen',
          } as Record<string, string>
        )[key] ?? key;
    save({
      ...p,
      profile: { ...p.profile, [key]: value },
      factProvenance: [
        ...(p.factProvenance ?? []).filter(
          (item) => item.canonicalKey !== canonicalKey,
        ),
        {
          id: uid(),
          canonicalKey,
          value,
          source: 'Practitioner manual entry',
          classification: 'manual_entry',
          recordedAt,
        },
      ],
      acquisitionEvents: [
        ...(p.acquisitionEvents ?? []),
        {
          id: uid(),
          type: 'manual_entry',
          canonicalKeys: [canonicalKey],
          source: 'Practitioner manual entry',
          occurredAt: recordedAt,
        },
      ],
      attested: false,
      updatedAt: recordedAt,
    });
  }
  function updateHistories(histories: ProviderHistories) {
    const currentPractice = histories.practices.find((item) => item.current),
      primaryEducation = histories.education[0],
      primaryLicense = histories.licenses[0],
      currentAffiliation =
        histories.affiliations.find((item) => item.current) ??
        histories.affiliations[0],
      recordedAt = now(),
      manualFacts = [
        ['education.medical_school', primaryEducation?.institution ?? ''],
        ['license.active', primaryLicense?.licenseNumber ?? ''],
        ['practice.primary_address', currentPractice?.address ?? ''],
        ['affiliation.hospital', currentAffiliation?.hospital ?? ''],
      ].filter((item) => item[1]),
      manualKeys = new Set(manualFacts.map(([canonicalKey]) => canonicalKey));
    save({
      ...p,
      histories,
      profile: {
        ...p.profile,
        education: primaryEducation?.institution ?? '',
        graduationYear: primaryEducation?.graduationYear ?? '',
        licenseState: primaryLicense?.state ?? '',
        licenseNumber: primaryLicense?.licenseNumber ?? '',
        practiceAddress: currentPractice?.address ?? '',
        hospitalAffiliation: currentAffiliation?.hospital ?? '',
      },
      factProvenance: [
        ...(p.factProvenance ?? []).filter(
          (item) => !manualKeys.has(item.canonicalKey),
        ),
        ...manualFacts.map(([canonicalKey, value]) => ({
          id: uid(),
          canonicalKey,
          value,
          source: 'Practitioner manual entry',
          classification: 'manual_entry' as const,
          recordedAt,
        })),
      ],
      attested: false,
      updatedAt: recordedAt,
    });
  }
  function resolveConflict(
    conflictId: string,
    optionId: string,
    customValue?: string,
  ) {
    const conflict = p.dataConflicts?.find((item) => item.id === conflictId),
      customOption = customValue?.trim()
        ? {
            id: optionId,
            value: customValue.trim(),
            source: 'Practitioner entered',
            retrievedAt: now(),
          }
        : undefined,
      option =
        customOption ?? conflict?.options.find((item) => item.id === optionId);
    if (!conflict || !option) return;
    const resolvedAt = now(),
      histories = historiesFor(p),
      nextHistories: ProviderHistories =
        conflict.fieldKey === 'practiceAddress'
          ? {
              ...histories,
              practices: histories.practices.length
                ? histories.practices.map((item, index) =>
                    item.current || index === 0
                      ? { ...item, address: option.value, current: true }
                      : item,
                  )
                : [
                    {
                      id: uid(),
                      organization: '',
                      address: option.value,
                      startYear: '',
                      endYear: '',
                      current: true,
                    },
                  ],
            }
          : conflict.fieldKey === 'education'
            ? {
                ...histories,
                education: histories.education.length
                  ? histories.education.map((item, index) =>
                      index === 0
                        ? { ...item, institution: option.value }
                        : item,
                    )
                  : [
                      {
                        id: uid(),
                        institution: option.value,
                        degree: p.profile.degree,
                        graduationYear: p.profile.graduationYear,
                      },
                    ],
              }
            : histories;
    save({
      ...p,
      profile: { ...p.profile, [conflict.fieldKey]: option.value },
      histories: nextHistories,
      dataConflicts: (p.dataConflicts ?? []).map((item) =>
        item.id === conflictId
          ? {
              ...item,
              options: customOption
                ? [...item.options, customOption]
                : item.options,
              historicalEvidence: item.historicalEvidence ?? item.options,
              selectedOptionId: optionId,
              resolvedAt,
            }
          : item,
      ),
      factProvenance: [
        ...(p.factProvenance ?? []).filter(
          (item) =>
            item.canonicalKey !== (conflict.canonicalKey ?? conflict.fieldKey),
        ),
        {
          id: uid(),
          canonicalKey: conflict.canonicalKey ?? conflict.fieldKey,
          value: option.value,
          source: option.source,
          classification: 'provider_confirmed',
          recordedAt: resolvedAt,
        },
      ],
      acquisitionEvents: [
        ...(p.acquisitionEvents ?? []),
        {
          id: uid(),
          type: 'conflict_resolution',
          canonicalKeys: [conflict.canonicalKey ?? conflict.fieldKey],
          source: option.source,
          occurredAt: resolvedAt,
        },
      ],
      attested: false,
      audit: [
        ...p.audit,
        {
          action: `Provider resolved ${conflict.label} conflict using ${option.source}`,
          at: resolvedAt,
        },
      ],
      updatedAt: resolvedAt,
    });
    notify('Conflict resolved and the confirmed value is now in your profile.');
  }
  function toggleOrg(org: string) {
    const on = p.selectedOrganizations.includes(org);
    if (on && submittedOrganizations.includes(org)) {
      notify('A submitted organization can’t be removed from its snapshot.');
      return;
    }
    if (on && p.selectedOrganizations.length === 1) {
      notify('Keep at least one organization on the application.');
      return;
    }
    const nextSelected = on
        ? p.selectedOrganizations.filter((x) => x !== org)
        : [...p.selectedOrganizations, org],
      reusableKeys = evaluateRequirements(p, [org])
        .filter((requirement) => requirement.satisfied)
        .map((requirement) => requirement.canonicalKey ?? requirement.id);
    save({
      ...p,
      selectedOrganizations: nextSelected,
      acquisitionEvents: on
        ? p.acquisitionEvents
        : [
            ...(p.acquisitionEvents ?? []),
            {
              id: uid(),
              type: 'record_reuse',
              canonicalKeys: reusableKeys,
              source: `Existing authorized profile reused for ${organizationName(org)}`,
              occurredAt: now(),
            },
          ],
      attested: false,
      updatedAt: now(),
    });
    setRecentlyAddedOrg(on ? '' : org);
    notify(
      on
        ? 'Organization removed from the draft.'
        : submittedOrganizations.length
          ? 'Organization added. Only its new requirements need review.'
          : 'Organization added. New requirements were calculated.',
    );
  }

  async function uploadCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const documentId = uid(),
      form = new FormData();
    form.set('file', file);
    form.set('documentId', documentId);
    notify('Reading the text in your CV…');
    try {
      const [extractResponse, stored] = await Promise.all([
          fetch('/api/cv/extract', { method: 'POST', body: form }),
          persistDocument(file),
        ]),
        extraction = (await extractResponse.json()) as {
          error?: string;
          candidates?: ExtractedCandidate[];
        };
      if (!extractResponse.ok || !extraction.candidates)
        throw new Error(extraction.error ?? 'Unable to extract the CV.');
      const occurredAt = now();
      save({
        ...p,
        documents: [
          ...p.documents,
          {
            id: documentId,
            name: file.name,
            type: 'cv',
            status: 'CV extracted locally · provider review required',
            storagePath: stored.path,
            size: stored.size,
            extractionStatus: 'pending_review',
          },
        ],
        extractedCandidates: [
          ...(p.extractedCandidates ?? []),
          ...extraction.candidates,
        ],
        acquisitionEvents: [
          ...(p.acquisitionEvents ?? []),
          {
            id: uid(),
            type: 'document_extraction',
            canonicalKeys: extraction.candidates.map(
              (candidate) => candidate.canonicalKey,
            ),
            source: 'Local text extraction from uploaded CV',
            occurredAt,
          },
        ],
        audit: [
          ...p.audit,
          {
            action: 'CV parsed locally; candidate facts awaiting review',
            at: occurredAt,
          },
        ],
        updatedAt: occurredAt,
      });
      notify(
        `${extraction.candidates.length} candidate facts found. Review each before it is added.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'CV extraction failed.');
    } finally {
      e.target.value = '';
    }
  }

  function reviewCandidate(
    candidateId: string,
    status: 'accepted' | 'ignored',
    correctedValue?: string,
  ) {
    const candidate = (p.extractedCandidates ?? []).find(
      (item) => item.id === candidateId,
    );
    if (!candidate) return;
    const value = correctedValue?.trim() || candidate.value,
      wasCorrected = Boolean(
        correctedValue?.trim() && correctedValue.trim() !== candidate.value,
      ),
      details = { ...candidate.details },
      reviewedAt = now(),
      nextCandidates = (p.extractedCandidates ?? []).map((item) =>
        item.id === candidateId ? { ...item, value, status } : item,
      );
    if (status === 'ignored') {
      save({
        ...p,
        extractedCandidates: nextCandidates,
        updatedAt: reviewedAt,
      });
      return;
    }
    const profile = { ...p.profile },
      practitioner = p.practitioner ? { ...p.practitioner } : undefined,
      dataConflicts = [...(p.dataConflicts ?? [])];
    let histories = historiesFor(p),
      careerTimeline = [...(p.careerTimeline ?? [])];
    if (candidate.kind === 'degree') profile.degree = value;
    if (candidate.kind === 'identity' && practitioner) {
      const parts = value.split(/\s+/);
      practitioner.firstName = parts[0] ?? practitioner.firstName;
      practitioner.lastName = parts.slice(1).join(' ') || practitioner.lastName;
    }
    if (candidate.kind === 'education') {
      const institution = wasCorrected
          ? value
          : String(details.institution ?? value),
        education = {
          id: uid(),
          institution,
          degree: String(details.degree ?? profile.degree),
          graduationYear: String(details.graduationYear ?? ''),
        };
      if (!histories.education.some((item) => item.institution === institution))
        histories = {
          ...histories,
          education: [...histories.education, education],
        };
      profile.education = institution;
      profile.graduationYear = education.graduationYear;
    }
    if (candidate.kind === 'license') {
      const license = {
        id: uid(),
        state: String(details.state ?? ''),
        licenseNumber: wasCorrected
          ? value
          : String(details.licenseNumber ?? value),
        licenseType: String(details.licenseType ?? profile.degree),
        expirationDate: String(details.expirationDate ?? ''),
      };
      if (
        !histories.licenses.some(
          (item) =>
            item.state === license.state &&
            item.licenseNumber === license.licenseNumber,
        )
      )
        histories = {
          ...histories,
          licenses: [...histories.licenses, license],
        };
      profile.licenseState ||= license.state;
      profile.licenseNumber ||= license.licenseNumber;
    }
    if (candidate.kind === 'employment' || candidate.kind === 'training') {
      const correctedParts = wasCorrected
        ? value.split('·').map((part) => part.trim())
        : [];
      const entry: CareerEntry = {
        id: uid(),
        category: (details.category as CareerEntry['category']) ?? 'employment',
        organization: correctedParts[1] ?? String(details.organization ?? ''),
        title: correctedParts[0] ?? String(details.title ?? ''),
        address: String(details.address ?? ''),
        startDate: String(details.startDate ?? ''),
        endDate: String(details.endDate ?? ''),
        current: Boolean(details.current),
        source: 'Extracted from uploaded CV — Provider Confirmed',
      };
      careerTimeline = [...careerTimeline, entry];
      if (entry.category === 'employment' && entry.address) {
        histories = {
          ...histories,
          practices: [
            ...histories.practices,
            {
              id: uid(),
              organization: entry.organization,
              address: entry.address,
              startYear: entry.startDate.slice(0, 4),
              endYear: entry.endDate.slice(0, 4),
              current: entry.current,
            },
          ],
        };
        if (
          entry.current &&
          profile.practiceAddress &&
          entry.address.toLowerCase() !==
            profile.practiceAddress.toLowerCase() &&
          !dataConflicts.some(
            (conflict) => conflict.canonicalKey === 'practice.primary_address',
          )
        ) {
          dataConflicts.push({
            id: `cv-practice-address-${candidate.id}`,
            fieldKey: 'practiceAddress',
            canonicalKey: 'practice.primary_address',
            context: 'primary_practice',
            label: 'Primary practice address',
            explanation:
              'A prior fictional record and the confirmed CV report different primary practice addresses. Which is currently correct?',
            options: [
              {
                id: `${candidate.id}-stored`,
                value: profile.practiceAddress,
                source: 'Existing fictional demonstration record',
                retrievedAt: p.updatedAt,
              },
              {
                id: `${candidate.id}-cv`,
                value: entry.address,
                source: 'Uploaded CV — Provider Confirmed',
                retrievedAt: reviewedAt,
              },
            ],
          });
        }
      }
    }
    const careerGaps = detectCareerGaps(careerTimeline).map((gap) => {
      const existing = (p.careerGaps ?? []).find((item) => item.id === gap.id);
      return existing ?? gap;
    });
    save({
      ...p,
      practitioner,
      profile,
      histories,
      careerTimeline,
      careerGaps,
      dataConflicts,
      extractedCandidates: nextCandidates,
      factProvenance: [
        ...(p.factProvenance ?? []).filter(
          (item) => item.canonicalKey !== candidate.canonicalKey,
        ),
        {
          id: uid(),
          canonicalKey: candidate.canonicalKey,
          value,
          source: 'Extracted from uploaded CV — Provider Confirmed',
          classification: 'document_extracted',
          sourceDocumentId: candidate.sourceDocumentId,
          recordedAt: reviewedAt,
        },
      ],
      documents: p.documents.map((document) =>
        document.id === candidate.sourceDocumentId &&
        !nextCandidates.some(
          (item) =>
            item.sourceDocumentId === document.id && item.status === 'pending',
        )
          ? {
              ...document,
              extractionStatus: 'confirmed',
              status: 'CV extracted locally · provider confirmed',
            }
          : document,
      ),
      attested: false,
      audit: [
        ...p.audit,
        {
          action: `Provider confirmed CV candidate: ${candidate.label}`,
          at: reviewedAt,
        },
      ],
      updatedAt: reviewedAt,
    });
  }

  function explainGap(gapId: string, explanation: string) {
    if (!explanation.trim()) return;
    const resolvedAt = now();
    save({
      ...p,
      careerGaps: (p.careerGaps ?? []).map((gap) =>
        gap.id === gapId
          ? { ...gap, explanation: explanation.trim(), resolvedAt }
          : gap,
      ),
      factProvenance: [
        ...(p.factProvenance ?? []),
        {
          id: uid(),
          canonicalKey: 'career.gap_explanation',
          value: explanation.trim(),
          source: 'Practitioner manual entry',
          classification: 'manual_entry',
          recordedAt: resolvedAt,
        },
      ],
      updatedAt: resolvedAt,
    });
    notify('Gap explanation saved. Your readiness has been recalculated.');
  }
  async function persistDocument(file: File) {
    const form = new FormData();
    form.set('file', file);
    form.set('practitionerId', p.id);
    const response = await fetch('/api/documents', {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as {
      error?: string;
      path?: string;
      size?: number;
    };
    if (!response.ok || !result.path)
      throw new Error(result.error ?? 'Unable to upload document');
    return result;
  }
  async function upload(
    e: React.ChangeEvent<HTMLInputElement>,
    type = 'license',
  ) {
    const f = e.target.files?.[0];
    if (!f) return;
    let stored: { path?: string; size?: number };
    try {
      stored = await persistDocument(f);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Document upload failed.',
      );
      return;
    }
    save({
      ...p,
      documents: [
        ...p.documents,
        {
          id: uid(),
          name: f.name,
          type,
          status: 'Provider supplied · not verified',
          storagePath: stored.path,
          size: stored.size,
        },
      ],
      updatedAt: now(),
    });
    notify('Document added to this practitioner’s profile.');
  }
  function submit() {
    if (
      !pendingOrganizations.length ||
      missing.length ||
      !p.attested ||
      !p.attestedBy?.trim()
    )
      return;
    save(createIncrementalSubmission(p, now(), uid));
    notify(
      `Application submitted to ${pendingOrganizations.length} new organization${pendingOrganizations.length > 1 ? 's' : ''}. Existing submissions were not changed.`,
    );
    go('credentialing', p.id);
  }
  function advance(caseId: string) {
    save({
      ...p,
      cases: p.cases.map((c) => {
        if (c.id !== caseId) return c;
        const org = c.organizationId;
        if (c.status === 'submitted')
          return {
            ...c,
            status: 'intake_review',
            events: [...c.events, event('Intake review started (Simulation)')],
          };
        if (c.status === 'intake_review' && org === 'evergreen')
          return {
            ...c,
            status: 'information_requested',
            request: {
              id: uid(),
              title: 'Updated malpractice insurance',
              detail:
                'Upload a current insurance certificate showing coverage dates.',
              status: 'open',
              createdAt: now(),
            },
            events: [...c.events, event('Additional information requested')],
          };
        if (c.status === 'intake_review')
          return {
            ...c,
            status: 'verification',
            events: [
              ...c.events,
              event('Primary-source verification started (Simulation)'),
            ],
          };
        if (c.status === 'verification')
          return {
            ...c,
            status: 'credentialing_review',
            events: [
              ...c.events,
              event('Credentialing review started (Simulation)'),
            ],
          };
        if (c.status === 'credentialing_review')
          return {
            ...c,
            status: 'approved',
            events: [...c.events, event('Approved (Simulation)')],
          };
        return c;
      }),
      updatedAt: now(),
    });
    notify('The simulated credentialing case advanced.');
  }
  async function respond(
    caseId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const f = e.target.files?.[0];
    if (!f) return;
    let stored: { path?: string; size?: number };
    try {
      stored = await persistDocument(f);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Document upload failed.',
      );
      return;
    }
    save({
      ...p,
      cases: p.cases.map((c) =>
        c.id === caseId && c.request
          ? {
              ...c,
              status: 'verification',
              request: {
                ...c.request,
                status: 'accepted',
                responseFile: f.name,
              },
              events: [
                ...c.events,
                event('Provider response received'),
                event('Verification resumed (Simulation)'),
              ],
            }
          : c,
      ),
      documents: [
        ...p.documents,
        {
          id: uid(),
          name: f.name,
          type: 'malpractice',
          status: 'Submitted for information request',
          storagePath: stored.path,
          size: stored.size,
        },
      ],
      updatedAt: now(),
    });
    notify('Response accepted. The simulated review has resumed.');
  }
  const name = `${p.practitioner?.firstName} ${p.practitioner?.lastName}`;
  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dashboard', onClick: () => go('dashboard') },
          { label: name, onClick: () => go('overview', p.id) },
          ...(view !== 'overview' ? [{ label: viewLabel(view) }] : []),
        ]}
      />
      <div className="workspace-head">
        <div className="person-title">
          <span>
            {p.practitioner?.firstName[0]}
            {p.practitioner?.lastName[0]}
          </span>
          <div>
            <h1>
              {name}, {p.profile.degree || p.practitioner?.credential}
            </h1>
            <p>
              NPI {p.practitioner?.npi} ·{' '}
              {p.practitioner?.taxonomies.find((t) => t.primary)?.description ??
                'Specialty unavailable'}{' '}
              · {p.selectedOrganizations.length} organizations
            </p>
          </div>
        </div>
        <div className="workspace-actions">
          {pendingOrganizations.length > 0 && (
            <button
              className="primary-button"
              onClick={() =>
                go(missing.length ? 'onboarding' : 'application', p.id)
              }
            >
              {missing.length ? 'Continue Application' : 'Review & Submit'}
              <ArrowRight size={13} />
            </button>
          )}
          {submittedOrganizations.length > 0 && (
            <button
              className="secondary-button"
              onClick={() => go('credentialing', p.id)}
            >
              View Credentialing
            </button>
          )}
        </div>
      </div>
      <nav className="workspace-tabs">
        {[
          ['overview', 'Overview'],
          ['application', 'Application'],
          ['credentialing', 'Credentialing'],
          ['documents', 'Documents'],
        ].map(([v, l]) => (
          <button
            className={
              view === v || (view === 'onboarding' && v === 'application')
                ? 'active'
                : ''
            }
            key={v}
            onClick={() => go(v, p.id)}
          >
            {l}
          </button>
        ))}
      </nav>
      {view === 'overview' && (
        <Overview
          p={p}
          reqs={reqs}
          missing={missing}
          pct={pct}
          go={go}
          toggleOrg={toggleOrg}
          recentlyAddedOrg={recentlyAddedOrg}
        />
      )}{' '}
      {view === 'onboarding' && (
        <Onboarding
          key={onboardingSection ?? 'default'}
          p={p}
          reqs={reqs}
          initialSection={onboardingSection}
          update={updateProfile}
          updateHistories={updateHistories}
          resolveConflict={resolveConflict}
          upload={upload}
          uploadCv={uploadCv}
          reviewCandidate={reviewCandidate}
          explainGap={explainGap}
          go={go}
        />
      )}{' '}
      {view === 'application' && (
        <Application
          p={p}
          reqs={reqs}
          missing={missing}
          save={save}
          submit={submit}
          pendingOrganizations={pendingOrganizations}
          go={go}
        />
      )}{' '}
      {view === 'credentialing' && (
        <Credentialing p={p} advance={advance} respond={respond} />
      )}{' '}
      {view === 'documents' && <Documents p={p} upload={upload} />}
    </>
  );
}
function event(label: string) {
  return { id: uid(), label, at: now(), visibleToProvider: true };
}
function viewLabel(v: string) {
  return (
    (
      {
        onboarding: 'Smart Onboarding',
        application: 'Application',
        credentialing: 'Credentialing',
        documents: 'Documents',
      } as Record<string, string>
    )[v] || v
  );
}

function Overview({
  p,
  reqs,
  missing,
  pct,
  go,
  toggleOrg,
  recentlyAddedOrg,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  missing: ReturnType<typeof evaluateRequirements>;
  pct: number;
  go: Navigate;
  toggleOrg: (id: string) => void;
  recentlyAddedOrg: string;
}) {
  const facts = p.practitioner?.nppes.facts.factCount ?? 0,
    submittedOrganizations = submittedOrganizationIds(p),
    nextAction = nextBestAction(p, missing),
    impact = acquisitionImpact(p, reqs),
    incrementalRequirements = recentlyAddedOrg
      ? evaluateRequirements(p, [recentlyAddedOrg])
      : [],
    incrementalMissing = incrementalRequirements.filter(
      (requirement) => !requirement.satisfied,
    );
  return (
    <div className="overview-grid">
      <div className="space-y-5">
        <section
          className={`surface readiness-card ${missing.length ? 'needs-attention' : ''}`}
        >
          <div>
            <p className="eyebrow">Application readiness</p>
            <h2>{pct}% complete</h2>
            <p>
              {missing.length
                ? `${missing.length} item${missing.length === 1 ? '' : 's'} require${missing.length === 1 ? 's' : ''} your attention.`
                : 'Everything required is ready for review.'}
            </p>
          </div>
          <div
            className={`ring ${missing.length ? 'warning' : ''}`}
            style={{ '--pct': `${pct * 3.6}deg` } as React.CSSProperties}
          >
            <span>{pct}%</span>
          </div>
          <button
            className="primary-button"
            onClick={() =>
              go(missing.length ? 'onboarding' : 'application', p.id)
            }
          >
            {missing.length ? 'Continue Application' : 'Review & Submit'}
            <ArrowRight size={13} />
          </button>
        </section>
        <section className="surface next-action-card">
          <span className="next-action-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="eyebrow">Your next step</p>
            <h2>{nextAction.label}</h2>
            <p>{nextAction.detail}</p>
            <button
              className="text-button"
              onClick={() =>
                nextAction.kind === 'review'
                  ? go('application', p.id)
                  : go('onboarding', p.id, nextAction.section)
              }
            >
              Continue <ArrowRight size={13} />
            </button>
          </div>
        </section>
        {recentlyAddedOrg && (
          <section className="surface incremental-summary">
            <CheckCircle2 size={19} />
            <div>
              <p className="eyebrow">Organization added</p>
              <h2>{organizationName(recentlyAddedOrg)}</h2>
              <p>
                Your existing profile covers{' '}
                {incrementalRequirements.length - incrementalMissing.length} of{' '}
                {incrementalRequirements.length} requirements.{' '}
                {incrementalMissing.length
                  ? `${incrementalMissing.length} additional item${incrementalMissing.length === 1 ? '' : 's'} ${incrementalMissing.length === 1 ? 'needs' : 'need'} attention.`
                  : 'No additional information is needed.'}
              </p>
              {incrementalMissing[0] && (
                <button
                  className="text-button"
                  onClick={() =>
                    go(
                      'onboarding',
                      p.id,
                      onboardingSectionForRequirement(
                        incrementalMissing[0].category,
                      ),
                    )
                  }
                >
                  Complete next requirement <ArrowRight size={13} />
                </button>
              )}
            </div>
          </section>
        )}
        <section className="surface panel">
          <div className="panel-head">
            <div>
              <h2>Outstanding actions</h2>
              <p>Complete the highest-priority items first.</p>
            </div>
          </div>
          {missing.length ? (
            <div className="task-list">
              {missing.slice(0, 5).map((r) => (
                <button
                  className="missing-task"
                  key={r.id}
                  onClick={() =>
                    go(
                      'onboarding',
                      p.id,
                      onboardingSectionForRequirement(r.category),
                    )
                  }
                >
                  <span>
                    <ClipboardCheck size={15} />
                  </span>
                  <div>
                    <b>{r.label}</b>
                    <small>
                      {r.category} · {r.organizationIds.length} organization
                      {r.organizationIds.length > 1 ? 's' : ''}
                    </small>
                  </div>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <div className="complete-state">
              <CheckCircle2 />
              No outstanding application tasks.
            </div>
          )}
        </section>
        <section className="surface panel">
          <div className="panel-head">
            <div>
              <h2>Organization readiness</h2>
              <p>Requirements are calculated independently.</p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                document.getElementById('add-org')?.scrollIntoView()
              }
            >
              + Add Organization
            </button>
          </div>
          <div className="org-readiness">
            {organizations
              .filter((o) => p.selectedOrganizations.includes(o.id))
              .map((o) => {
                const isSubmitted = submittedOrganizations.includes(o.id),
                  orgReq = reqs.filter((r) => r.organizationIds.includes(o.id)),
                  left = orgReq.filter((r) => !r.satisfied).length;
                return (
                  <div
                    className={left ? 'org-needs-attention' : 'org-ready'}
                    key={o.id}
                  >
                    <span className="org-mark">
                      <Building2 size={15} />
                    </span>
                    <div>
                      <b>{o.name}</b>
                      <small>
                        {isSubmitted
                          ? 'Immutable application snapshot submitted'
                          : left
                            ? `${left} missing requirement${left > 1 ? 's' : ''}`
                            : 'Ready for submission'}
                      </small>
                    </div>
                    <Status
                      text={
                        isSubmitted
                          ? 'Submitted'
                          : left
                            ? `${left} remaining`
                            : 'Ready'
                      }
                      tone={left && !isSubmitted ? 'red' : 'green'}
                    />
                    <RemoveOrganizationDialog
                      organizationName={o.name}
                      disabled={
                        submittedOrganizations.includes(o.id) ||
                        p.selectedOrganizations.length === 1
                      }
                      disabledReason={
                        submittedOrganizations.includes(o.id)
                          ? 'Submitted organizations cannot be removed'
                          : 'At least one organization is required'
                      }
                      onRemove={() => toggleOrg(o.id)}
                    />
                  </div>
                );
              })}
          </div>
        </section>
        {organizations.some((o) => !p.selectedOrganizations.includes(o.id)) && (
          <section id="add-org" className="surface panel">
            <div className="panel-head">
              <div>
                <h2>Add another organization</h2>
                <p>
                  Existing permitted information will be reused automatically.
                </p>
              </div>
            </div>
            <div className="inline-orgs">
              {organizations
                .filter((o) => !p.selectedOrganizations.includes(o.id))
                .map((o) => {
                  return (
                    <button onClick={() => toggleOrg(o.id)} key={o.id}>
                      <Building2 size={15} />
                      <span>
                        <b>{o.name}</b>
                        <small>Add without restarting</small>
                      </span>
                      <Plus size={14} />
                    </button>
                  );
                })}
            </div>
          </section>
        )}
      </div>
      <aside className="space-y-5">
        <details className="surface panel impact-details">
          <summary>
            <span>
              <Sparkles size={16} />
              <b>How we simplified your application</b>
            </span>
            <ChevronRight size={14} />
          </summary>
          <div className="data-stats">
            <div>
              <b>{impact.reused}</b>
              <span>Authorized facts reused</span>
            </div>
            <div>
              <b>{impact.imported || facts}</b>
              <span>Demo facts imported</span>
            </div>
            <div>
              <b>{impact.extracted}</b>
              <span>CV facts confirmed</span>
            </div>
            <div>
              <b>{impact.manual}</b>
              <span>Facts manually entered</span>
            </div>
            <div>
              <b>{impact.conflictsResolved}</b>
              <span>Conflicts resolved</span>
            </div>
            <div>
              <b>{impact.outstanding}</b>
              <span>Outstanding required</span>
            </div>
            <div>
              <b>{impact.duplicateRequestsAvoided}</b>
              <span>Duplicate requests avoided</span>
            </div>
          </div>
          <div className="prototype-comparison">
            <b>Traditional forms vs. Smart Onboarding</b>
            <small>
              Prototype comparison calculated from current requirements
            </small>
            <span>{impact.baselineQuestions} applicable form requests</span>
            <span>
              {impact.satisfiedWithoutNewEntry} satisfied without new entry
            </span>
            <span>
              {impact.remainingProviderQuestions} remaining provider questions
            </span>
          </div>
          <p className="source-note">
            <i /> Fictional demonstration data and CV-extracted facts are not
            primary-source verification.
          </p>
        </details>
        {p.cases.length > 0 && (
          <section className="surface panel">
            <h2>Credentialing summary</h2>
            {p.cases.map((c) => (
              <button
                className="case-summary"
                key={c.id}
                onClick={() => go('credentialing', p.id)}
              >
                <span>
                  <b>
                    {organizations.find((o) => o.id === c.organizationId)?.name}
                  </b>
                  <small>{caseLabels[c.status]}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}

function RemoveOrganizationDialog({
  organizationName,
  disabled,
  disabledReason,
  onRemove,
}: {
  organizationName: string;
  disabled: boolean;
  disabledReason: string;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className="remove-org-button"
            aria-label={`Remove ${organizationName}`}
            title={disabled ? disabledReason : `Remove ${organizationName}`}
          />
        }
      >
        <X size={14} />
      </AlertDialogTrigger>
      <AlertDialogContent className="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogMedia className="remove-org-dialog-icon">
            <Building2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove {organizationName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its requirements will be removed from readiness and your completion
            score will be recalculated immediately. Your shared profile stays
            intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep organization</AlertDialogCancel>
          <AlertDialogAction
            className="danger-confirm"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          >
            Remove organization
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Onboarding({
  p,
  reqs,
  initialSection,
  update,
  updateHistories,
  resolveConflict,
  upload,
  uploadCv,
  reviewCandidate,
  explainGap,
  go,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  initialSection?: OnboardingSection;
  update: (k: keyof ManagedPractitioner['profile'], v: string) => void;
  updateHistories: (histories: ProviderHistories) => void;
  resolveConflict: (
    conflictId: string,
    optionId: string,
    customValue?: string,
  ) => void;
  upload: (e: React.ChangeEvent<HTMLInputElement>, t?: string) => void;
  uploadCv: (e: React.ChangeEvent<HTMLInputElement>) => void;
  reviewCandidate: (
    candidateId: string,
    status: 'accepted' | 'ignored',
    correctedValue?: string,
  ) => void;
  explainGap: (gapId: string, explanation: string) => void;
  go: Navigate;
}) {
  const sections = onboardingSections(p),
    [activeSection, setActiveSection] = useState<OnboardingSection>(
      initialSection && sections.includes(initialSection)
        ? initialSection
        : 'Professional details',
    ),
    activeIndex = sections.indexOf(activeSection),
    missing = reqs.filter((r) => !r.satisfied),
    histories = historiesFor(p),
    pct = reqs.length
      ? Math.round(((reqs.length - missing.length) / reqs.length) * 100)
      : 0;
  return (
    <div className="onboarding-layout">
      <aside className="onboarding-nav">
        <p className="eyebrow">Smart onboarding</p>
        <h3>{pct}% complete</h3>
        <div className="mini-progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        {sections.map((section) => {
          const done = isOnboardingSectionComplete(p, section);
          return (
            <button
              type="button"
              key={section}
              className={`${done ? 'done' : ''} ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              <span>{done ? <Check size={11} /> : ''}</span>
              {section}
              <ChevronRight size={13} />
            </button>
          );
        })}
        <button
          className="secondary-button"
          onClick={() => go('overview', p.id)}
        >
          Save & Exit
        </button>
      </aside>
      <div className="space-y-5">
        <section className="onboarding-intro">
          <div>
            <p className="eyebrow">Only what needs attention</p>
            <h2>
              Let’s complete {p.practitioner?.firstName}{' '}
              {p.practitioner?.lastName}’s profile
            </h2>
            <p>
              {pct < 50
                ? 'We already found part of the profile. Review each short section and fill only what is missing.'
                : pct < 100
                  ? 'Great progress. A few focused sections remain before the final review.'
                  : 'Profile complete. Continue to one final review and attestation.'}
            </p>
          </div>
          <span>
            {missing.length}
            <small>items left</small>
          </span>
        </section>
        <section className="surface cv-acquisition-card" id="cv-acquisition">
          <span className="cv-icon">
            <FileText size={20} />
          </span>
          <div>
            <p className="eyebrow">Optional time saver</p>
            <h2>Upload your CV to save time</h2>
            <p>
              We&apos;ll identify your education, training, and professional
              experience so you don&apos;t have to enter everything manually.
            </p>
            <small>
              Text-based PDF only · extracted locally · nothing is accepted
              without your review
            </small>
          </div>
          <label className="secondary-button cv-upload-button">
            <Upload size={15} /> Upload CV
            <input
              hidden
              type="file"
              accept="application/pdf"
              onChange={uploadCv}
            />
          </label>
        </section>
        {(p.extractedCandidates ?? []).some(
          (candidate) => candidate.status === 'pending',
        ) && (
          <section className="surface panel candidate-review" id="cv-review">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Provider review required</p>
                <h2>Review details found in your CV</h2>
                <p>
                  Accept, correct, or ignore each candidate. Extracted text is
                  not primary-source verification.
                </p>
              </div>
            </div>
            <div className="candidate-list">
              {(p.extractedCandidates ?? [])
                .filter((candidate) => candidate.status === 'pending')
                .map((candidate) => (
                  <CvCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    reviewCandidate={reviewCandidate}
                  />
                ))}
            </div>
          </section>
        )}
        {activeSection === 'Resolve conflicts' && (
          <section
            key={activeSection}
            className="surface panel onboarding-section conflict-section"
          >
            <p className="eyebrow">Confirm what is current</p>
            <h2>Resolve source conflicts</h2>
            <p className="panel-copy">
              We found different values for the same canonical field across
              demonstration records and confirmed documents. Choose what is
              accurate today—we will preserve the earlier evidence.
            </p>
            <div className="conflict-list">
              {(p.dataConflicts ?? []).map((conflict) => (
                <article
                  className={`conflict-card ${conflict.resolvedAt ? 'resolved' : ''}`}
                  key={conflict.id}
                >
                  <div className="history-card-head">
                    <div>
                      <h3>{conflict.label}</h3>
                      <p>{conflict.explanation}</p>
                    </div>
                    <Status
                      text={conflict.resolvedAt ? 'Confirmed' : 'Needs review'}
                      tone={conflict.resolvedAt ? 'green' : 'red'}
                    />
                  </div>
                  <div className="conflict-options">
                    {conflict.options.map((option) => {
                      const selected = conflict.selectedOptionId === option.id;
                      return (
                        <button
                          type="button"
                          className={selected ? 'selected' : ''}
                          key={option.id}
                          onClick={() =>
                            resolveConflict(conflict.id, option.id)
                          }
                        >
                          <span className="choice-dot">
                            {selected && <Check size={12} />}
                          </span>
                          <span>
                            <b>{option.value}</b>
                            <small>
                              {option.source} · retrieved{' '}
                              {new Date(
                                option.retrievedAt,
                              ).toLocaleDateString()}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!conflict.resolvedAt && (
                    <CustomConflictValue
                      conflictId={conflict.id}
                      resolveConflict={resolveConflict}
                    />
                  )}
                  <details className="conflict-details">
                    <summary>Review details</summary>
                    <p>
                      Compared only as{' '}
                      <b>{conflict.context ?? 'the same canonical field'}</b>.
                      Historical evidence is preserved after you choose the
                      current value.
                    </p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        )}
        {activeSection !== 'Documents' &&
          activeSection !== 'Resolve conflicts' && (
            <section
              key={activeSection}
              className="surface panel onboarding-section"
            >
              <p className="eyebrow">
                Step {activeIndex + 1} of {sections.length}
              </p>
              <h2>{activeSection}</h2>
              <p className="panel-copy">
                Review prefilled values and complete anything still missing.
              </p>
              <div className="form-grid">
                {activeSection === 'Professional details' && (
                  <SelectField
                    label="Professional degree"
                    value={p.profile.degree}
                    options={degreeOptions}
                    onChange={(v) => update('degree', v)}
                  />
                )}
                {activeSection === 'License' && (
                  <div className="repeatable-history">
                    {histories.licenses.map((license, index) => (
                      <article className="history-card" key={license.id}>
                        <HistoryCardHeader
                          title={`License ${index + 1}`}
                          subtitle={
                            index === 0
                              ? 'Used as the primary license'
                              : 'Additional professional license'
                          }
                          onRemove={() =>
                            updateHistories({
                              ...histories,
                              licenses: histories.licenses.filter(
                                (item) => item.id !== license.id,
                              ),
                            })
                          }
                        />
                        <div className="history-fields four-columns">
                          <SelectField
                            label="State"
                            value={license.state}
                            options={stateOptions}
                            onChange={(value) =>
                              updateHistories({
                                ...histories,
                                licenses: histories.licenses.map((item) =>
                                  item.id === license.id
                                    ? { ...item, state: value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Field label="License number">
                            <input
                              className="input w-full"
                              value={license.licenseNumber}
                              onChange={(event) =>
                                updateHistories({
                                  ...histories,
                                  licenses: histories.licenses.map((item) =>
                                    item.id === license.id
                                      ? {
                                          ...item,
                                          licenseNumber: event.target.value,
                                        }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="License number"
                            />
                          </Field>
                          <SelectField
                            label="License type"
                            value={license.licenseType}
                            options={degreeOptions}
                            onChange={(value) =>
                              updateHistories({
                                ...histories,
                                licenses: histories.licenses.map((item) =>
                                  item.id === license.id
                                    ? { ...item, licenseType: value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Field label="Expiration date">
                            <input
                              className="input w-full"
                              type="date"
                              value={license.expirationDate}
                              onChange={(event) =>
                                updateHistories({
                                  ...histories,
                                  licenses: histories.licenses.map((item) =>
                                    item.id === license.id
                                      ? {
                                          ...item,
                                          expirationDate: event.target.value,
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </Field>
                        </div>
                      </article>
                    ))}
                    <AddHistoryButton
                      label="Add another license"
                      onClick={() =>
                        updateHistories({
                          ...histories,
                          licenses: [
                            ...histories.licenses,
                            {
                              id: uid(),
                              state: '',
                              licenseNumber: '',
                              licenseType: p.profile.degree,
                              expirationDate: '',
                            },
                          ],
                        })
                      }
                    />
                  </div>
                )}
                {activeSection === 'Education' && (
                  <div className="repeatable-history">
                    {histories.education.map((education, index) => (
                      <article className="history-card" key={education.id}>
                        <HistoryCardHeader
                          title={`Education ${index + 1}`}
                          subtitle={
                            index === 0
                              ? 'Used as the primary education record'
                              : 'Additional education or training'
                          }
                          onRemove={() =>
                            updateHistories({
                              ...histories,
                              education: histories.education.filter(
                                (item) => item.id !== education.id,
                              ),
                            })
                          }
                        />
                        <div className="history-fields three-columns">
                          <Field label="Institution">
                            <input
                              className="input w-full"
                              value={education.institution}
                              onChange={(event) =>
                                updateHistories({
                                  ...histories,
                                  education: histories.education.map((item) =>
                                    item.id === education.id
                                      ? {
                                          ...item,
                                          institution: event.target.value,
                                        }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="Institution name"
                            />
                          </Field>
                          <SelectField
                            label="Degree"
                            value={education.degree}
                            options={degreeOptions}
                            onChange={(value) =>
                              updateHistories({
                                ...histories,
                                education: histories.education.map((item) =>
                                  item.id === education.id
                                    ? { ...item, degree: value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <SelectField
                            label="Graduation year"
                            value={education.graduationYear}
                            options={yearOptions}
                            onChange={(value) =>
                              updateHistories({
                                ...histories,
                                education: histories.education.map((item) =>
                                  item.id === education.id
                                    ? { ...item, graduationYear: value }
                                    : item,
                                ),
                              })
                            }
                          />
                        </div>
                      </article>
                    ))}
                    <AddHistoryButton
                      label="Add education or training"
                      onClick={() =>
                        updateHistories({
                          ...histories,
                          education: [
                            ...histories.education,
                            {
                              id: uid(),
                              institution: '',
                              degree: '',
                              graduationYear: '',
                            },
                          ],
                        })
                      }
                    />
                  </div>
                )}
                {activeSection === 'Practice' && (
                  <div className="repeatable-history">
                    <CareerTimeline
                      entries={p.careerTimeline ?? []}
                      gaps={p.careerGaps ?? []}
                      explainGap={explainGap}
                    />
                    <PracticeHistoryEditor
                      histories={histories}
                      updateHistories={updateHistories}
                    />
                  </div>
                )}
                {activeSection === 'Affiliations' && (
                  <AffiliationHistoryEditor
                    histories={histories}
                    updateHistories={updateHistories}
                  />
                )}
                {activeSection === 'Coverage' && (
                  <SelectField
                    label="Malpractice carrier"
                    value={p.profile.malpracticeCarrier}
                    options={carriers}
                    onChange={(v) => update('malpracticeCarrier', v)}
                  />
                )}
                {activeSection === 'Disclosures' && (
                  <SelectField
                    label="Professional disclosure"
                    value={p.profile.disclosure}
                    options={[
                      'No — no reportable events',
                      'Yes — explanation required',
                    ]}
                    onChange={(v) => update('disclosure', v)}
                  />
                )}
              </div>
            </section>
          )}
        {activeSection === 'Documents' && (
          <section
            key={activeSection}
            className="surface panel onboarding-section"
          >
            <p className="eyebrow">
              Step {activeIndex + 1} of {sections.length}
            </p>
            <h2>Supporting documents</h2>
            <p className="panel-copy">
              Upload demonstration documents only. Uploaded evidence is not
              automatically verified.
            </p>
            <label className="upload cv-document-upload">
              <FileText size={16} />
              Upload CV and identify candidate facts
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={uploadCv}
              />
            </label>
            <label className="upload">
              <Upload size={16} />
              Upload license document
              <input
                hidden
                type="file"
                onChange={(e) => upload(e, 'license')}
              />
            </label>
            {p.documents.map((d) => (
              <div className="document-row" key={d.id}>
                <FileCheck2 size={16} />
                <span>
                  <b>{d.name}</b>
                  <small>{d.status}</small>
                </span>
              </div>
            ))}
          </section>
        )}
        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={() => go('overview', p.id)}
          >
            Save & Exit
          </button>
          <button
            className="primary-button"
            onClick={() => {
              if (activeIndex < sections.length - 1)
                setActiveSection(sections[activeIndex + 1]);
              else go('application', p.id);
            }}
          >
            {activeIndex < sections.length - 1
              ? `Next: ${sections[activeIndex + 1]}`
              : 'Review all information'}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CvCandidateCard({
  candidate,
  reviewCandidate,
}: {
  candidate: ExtractedCandidate;
  reviewCandidate: (
    candidateId: string,
    status: 'accepted' | 'ignored',
    correctedValue?: string,
  ) => void;
}) {
  const [value, setValue] = useState(candidate.value),
    [editing, setEditing] = useState(false);
  return (
    <article className="candidate-card">
      <div>
        <span className="candidate-kind">{candidate.kind}</span>
        <h3>{candidate.label}</h3>
        {editing ? (
          <input
            className="input w-full"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`Correct ${candidate.label}`}
          />
        ) : (
          <p>{value}</p>
        )}
        <small>
          Extracted from uploaded CV · {candidate.confidence} confidence · not
          verified
        </small>
      </div>
      <div className="candidate-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => reviewCandidate(candidate.id, 'accepted', value)}
        >
          <Check size={13} /> Accept
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? 'Use correction' : 'Correct'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => reviewCandidate(candidate.id, 'ignored')}
        >
          Ignore
        </button>
      </div>
    </article>
  );
}

function CustomConflictValue({
  conflictId,
  resolveConflict,
}: {
  conflictId: string;
  resolveConflict: (
    conflictId: string,
    optionId: string,
    customValue?: string,
  ) => void;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState('');
  if (!open)
    return (
      <button
        type="button"
        className="text-button enter-different"
        onClick={() => setOpen(true)}
      >
        Enter a different value
      </button>
    );
  return (
    <div className="custom-conflict-value">
      <input
        className="input w-full"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Enter the current value"
      />
      <button
        type="button"
        className="primary-button"
        disabled={!value.trim()}
        onClick={() =>
          resolveConflict(conflictId, `${conflictId}-custom`, value)
        }
      >
        Use this value
      </button>
    </div>
  );
}

function CareerTimeline({
  entries,
  gaps,
  explainGap,
}: {
  entries: CareerEntry[];
  gaps: NonNullable<ManagedPractitioner['careerGaps']>;
  explainGap: (gapId: string, explanation: string) => void;
}) {
  return (
    <section className="career-timeline-card">
      <div className="history-card-head">
        <div>
          <h3>Career timeline</h3>
          <p>
            Training and concurrent positions are shown together. Overlap is
            allowed and is not treated as an error.
          </p>
        </div>
      </div>
      {entries.length ? (
        <div className="career-timeline">
          {[...entries]
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .map((entry) => (
              <article key={entry.id}>
                <i />
                <span>
                  <b>{entry.title || entry.category}</b>
                  <small>{entry.organization}</small>
                  <em>
                    {monthYear(entry.startDate)} –{' '}
                    {entry.current ? 'Present' : monthYear(entry.endDate)}
                  </em>
                </span>
              </article>
            ))}
        </div>
      ) : (
        <p className="timeline-empty">
          Upload a CV or add practice history manually to build the timeline.
        </p>
      )}
      {gaps
        .filter((gap) => !gap.resolvedAt)
        .map((gap) => (
          <GapExplanation key={gap.id} gap={gap} explainGap={explainGap} />
        ))}
    </section>
  );
}

function GapExplanation({
  gap,
  explainGap,
}: {
  gap: NonNullable<ManagedPractitioner['careerGaps']>[number];
  explainGap: (gapId: string, explanation: string) => void;
}) {
  const [explanation, setExplanation] = useState('');
  return (
    <div className="gap-task">
      <Clock3 size={17} />
      <div>
        <b>
          We noticed a gap in your professional history between{' '}
          {monthYear(gap.startDate)} and {monthYear(gap.endDate)}. Could you
          briefly explain this period?
        </b>
        <textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="For example: parental leave, relocation, or personal leave"
        />
        <button
          type="button"
          className="primary-button"
          disabled={!explanation.trim()}
          onClick={() => explainGap(gap.id, explanation)}
        >
          Save explanation
        </button>
      </div>
    </div>
  );
}

function HistoryCardHeader({
  title,
  subtitle,
  onRemove,
}: {
  title: string;
  subtitle: string;
  onRemove: () => void;
}) {
  return (
    <div className="history-card-head">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button
        type="button"
        className="history-remove"
        onClick={onRemove}
        aria-label={`Remove ${title}`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function AddHistoryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="add-history-button" onClick={onClick}>
      <Plus size={15} />
      {label}
    </button>
  );
}

function PracticeHistoryEditor({
  histories,
  updateHistories,
}: {
  histories: ProviderHistories;
  updateHistories: (histories: ProviderHistories) => void;
}) {
  function update(id: string, patch: Partial<PracticeHistory>) {
    updateHistories({
      ...histories,
      practices: histories.practices.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : patch.current
            ? { ...item, current: false }
            : item,
      ),
    });
  }
  return (
    <div className="repeatable-history">
      {histories.practices.map((practice, index) => (
        <article className="history-card" key={practice.id}>
          <HistoryCardHeader
            title={`Practice ${index + 1}`}
            subtitle={
              practice.current
                ? 'Current primary practice'
                : 'Previous practice'
            }
            onRemove={() =>
              updateHistories({
                ...histories,
                practices: histories.practices.filter(
                  (item) => item.id !== practice.id,
                ),
              })
            }
          />
          <div className="history-fields two-columns">
            <Field label="Organization or practice name">
              <input
                className="input w-full"
                value={practice.organization}
                onChange={(event) =>
                  update(practice.id, { organization: event.target.value })
                }
                placeholder="Practice name"
              />
            </Field>
            <Field label="Practice address">
              <input
                className="input w-full"
                value={practice.address}
                onChange={(event) =>
                  update(practice.id, { address: event.target.value })
                }
                placeholder="Street, city, state, ZIP"
              />
            </Field>
            <SelectField
              label="Start year"
              value={practice.startYear}
              options={yearOptions}
              onChange={(value) => update(practice.id, { startYear: value })}
            />
            <SelectField
              label="End year"
              value={practice.endYear}
              options={yearOptions}
              onChange={(value) => update(practice.id, { endYear: value })}
            />
          </div>
          <label className="current-record">
            <input
              type="checkbox"
              checked={practice.current}
              onChange={(event) =>
                update(practice.id, {
                  current: event.target.checked,
                  endYear: event.target.checked ? '' : practice.endYear,
                })
              }
            />
            This is my current primary practice
          </label>
        </article>
      ))}
      <AddHistoryButton
        label="Add another practice"
        onClick={() =>
          updateHistories({
            ...histories,
            practices: [
              ...histories.practices,
              {
                id: uid(),
                organization: '',
                address: '',
                startYear: '',
                endYear: '',
                current: histories.practices.length === 0,
              },
            ],
          })
        }
      />
    </div>
  );
}

function AffiliationHistoryEditor({
  histories,
  updateHistories,
}: {
  histories: ProviderHistories;
  updateHistories: (histories: ProviderHistories) => void;
}) {
  function update(id: string, patch: Partial<AffiliationHistory>) {
    updateHistories({
      ...histories,
      affiliations: histories.affiliations.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  return (
    <div className="repeatable-history">
      {histories.affiliations.map((affiliation, index) => (
        <article className="history-card" key={affiliation.id}>
          <HistoryCardHeader
            title={`Affiliation ${index + 1}`}
            subtitle={
              affiliation.current
                ? 'Current affiliation'
                : 'Previous affiliation'
            }
            onRemove={() =>
              updateHistories({
                ...histories,
                affiliations: histories.affiliations.filter(
                  (item) => item.id !== affiliation.id,
                ),
              })
            }
          />
          <div className="history-fields three-columns">
            <SelectField
              label="Hospital or facility"
              value={affiliation.hospital}
              options={hospitals}
              onChange={(value) => update(affiliation.id, { hospital: value })}
            />
            <SelectField
              label="Start year"
              value={affiliation.startYear}
              options={yearOptions}
              onChange={(value) => update(affiliation.id, { startYear: value })}
            />
            <SelectField
              label="End year"
              value={affiliation.endYear}
              options={yearOptions}
              onChange={(value) => update(affiliation.id, { endYear: value })}
            />
          </div>
          <label className="current-record">
            <input
              type="checkbox"
              checked={affiliation.current}
              onChange={(event) =>
                update(affiliation.id, {
                  current: event.target.checked,
                  endYear: event.target.checked ? '' : affiliation.endYear,
                })
              }
            />
            This affiliation is current
          </label>
        </article>
      ))}
      <AddHistoryButton
        label="Add another affiliation"
        onClick={() =>
          updateHistories({
            ...histories,
            affiliations: [
              ...histories.affiliations,
              {
                id: uid(),
                hospital: '',
                startYear: '',
                endYear: '',
                current: true,
              },
            ],
          })
        }
      />
    </div>
  );
}

function ReviewHistory({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="review-history">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function ReviewHistoryRow({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="review-history-row">
      <CheckCircle2 size={16} />
      <span>
        <b>{title}</b>
        <small>{detail || 'Additional details not provided'}</small>
      </span>
    </div>
  );
}

function Application({
  p,
  reqs,
  missing,
  save,
  submit,
  pendingOrganizations,
  go,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  missing: ReturnType<typeof evaluateRequirements>;
  save: (p: ManagedPractitioner) => void;
  submit: () => void;
  pendingOrganizations: string[];
  go: (v: string, id?: string) => void;
}) {
  const histories = historiesFor(p),
    submissions = p.submissions ?? [];
  if (!pendingOrganizations.length && submissions.length)
    return (
      <section className="surface submitted-snapshot">
        <CheckCircle2 />
        <p className="eyebrow">All selected organizations submitted</p>
        <h2>Your immutable application snapshots are ready</h2>
        <p>
          Each organization received its own read-only snapshot. Updating your
          shared profile or adding another organization will not change these
          submitted records.
        </p>
        <div className="snapshot-list">
          {submissions.map((snapshot) => (
            <article key={snapshot.id}>
              <Building2 size={16} />
              <span>
                <b>
                  {
                    organizations.find(
                      (organization) =>
                        organization.id === snapshot.organizationId,
                    )?.name
                  }
                </b>
                <small>
                  Submitted {new Date(snapshot.submittedAt).toLocaleString()} ·
                  version {snapshot.requirementVersion}
                </small>
              </span>
              <Status text="Submitted" tone="green" />
            </article>
          ))}
        </div>
        <div className="snapshot-actions">
          <button
            className="secondary-button"
            onClick={() => go('overview', p.id)}
          >
            Add another organization
          </button>
          <button
            className="primary-button"
            onClick={() => go('credentialing', p.id)}
          >
            View Credentialing
          </button>
        </div>
      </section>
    );
  return (
    <div className="review-layout">
      <section className="surface panel review-document">
        <div className="panel-head">
          <div>
            <h2>Consolidated professional application</h2>
            <p>
              Review acquired and manually provided information before
              submitting.
            </p>
          </div>
          <Status
            text={`${Math.round((reqs.filter((r) => r.satisfied).length / Math.max(reqs.length, 1)) * 100)}% complete`}
            tone={missing.length ? 'blue' : 'green'}
          />
        </div>
        {submissions.length > 0 && (
          <div className="incremental-banner">
            <Sparkles size={17} />
            <span>
              <b>Only the new organizations will receive this submission.</b>
              <small>
                Your {submissions.length} existing snapshot
                {submissions.length > 1 ? 's are' : ' is'} unchanged.
              </small>
            </span>
          </div>
        )}
        <dl className="review-list">
          {[
            [
              'Practitioner',
              `${p.practitioner?.firstName} ${p.practitioner?.lastName}`,
            ],
            ['NPI', p.practitioner?.npi],
            ['Contact email', p.contactEmail],
            ['CAQH ID', p.caqhId || 'Not provided'],
            ['Professional degree', p.profile.degree],
            [
              'Primary specialty',
              p.practitioner?.taxonomies.find((taxonomy) => taxonomy.primary)
                ?.description,
            ],
            ['Malpractice carrier', p.profile.malpracticeCarrier],
            ['Professional disclosure', p.profile.disclosure],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
        <ReviewHistory title="Education history">
          {histories.education.map((item) => (
            <ReviewHistoryRow
              key={item.id}
              title={item.institution || 'Institution not provided'}
              detail={[item.degree, item.graduationYear]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </ReviewHistory>
        <ReviewHistory title="License history">
          {histories.licenses.map((item) => (
            <ReviewHistoryRow
              key={item.id}
              title={`${item.state || 'State'} ${item.licenseNumber || 'License number not provided'}`}
              detail={[
                item.licenseType,
                item.expirationDate && `Expires ${item.expirationDate}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </ReviewHistory>
        <ReviewHistory title="Practice history">
          {histories.practices.map((item) => (
            <ReviewHistoryRow
              key={item.id}
              title={item.organization || 'Practice'}
              detail={`${item.address || 'Address not provided'}${item.current ? ' · Current' : ''}`}
            />
          ))}
        </ReviewHistory>
        {histories.affiliations.length > 0 && (
          <ReviewHistory title="Affiliation history">
            {histories.affiliations.map((item) => (
              <ReviewHistoryRow
                key={item.id}
                title={item.hospital || 'Facility not provided'}
                detail={`${[item.startYear, item.endYear].filter(Boolean).join('–')}${item.current ? ' · Current' : ''}`}
              />
            ))}
          </ReviewHistory>
        )}
        <div className="selected-org-list">
          <h3>Organizations in this submission</h3>
          {pendingOrganizations.map((id) => (
            <div key={id}>
              <Building2 size={15} />
              <span>
                <b>{organizations.find((o) => o.id === id)?.name}</b>
                <small>
                  Requirement version 1 · Fictional demonstration organization
                </small>
              </span>
            </div>
          ))}
        </div>
        <div className="review-documents">
          <h3>Supporting documents</h3>
          {p.documents.length ? (
            p.documents.map((document) => (
              <div key={document.id}>
                <FileCheck2 size={16} />
                <span>
                  <b>{document.name}</b>
                  <small>{document.status}</small>
                </span>
              </div>
            ))
          ) : (
            <p>No supporting documents uploaded.</p>
          )}
        </div>
        <div className="signature-block">
          <p className="eyebrow">Final attestation</p>
          <h3>Sign and submit this application</h3>
          <p>
            Review every item above. Type your full legal name and confirm the
            attestation to enable submission.
          </p>
          <Field label="Type full legal name">
            <input
              className="input w-full"
              value={p.attestedBy ?? ''}
              onChange={(event) =>
                save({
                  ...p,
                  attestedBy: event.target.value,
                  attested: false,
                  updatedAt: now(),
                })
              }
              placeholder="Full legal name"
            />
          </Field>
          <label className="attestation">
            <input
              type="checkbox"
              checked={p.attested}
              onChange={(e) =>
                save({ ...p, attested: e.target.checked, updatedAt: now() })
              }
              disabled={!p.attestedBy?.trim()}
            />
            <span>
              <b>Demonstration practitioner attestation v1.0</b>
              <small>
                I have reviewed this application and affirm that the information
                is accurate to the best of my knowledge. This prototype
                acknowledgement is not production identity proofing or a legal
                e-signature.
              </small>
            </span>
          </label>
        </div>
      </section>
      <aside className="surface submit-panel review-submit-panel">
        <h3>Submission readiness</h3>
        <Ready
          ok={missing.length === 0}
          text={`${missing.length} unresolved requirements`}
        />
        <Ready
          ok={p.documents.some((d) => d.type === 'license')}
          text="License document"
        />
        <Ready ok={Boolean(p.attestedBy?.trim())} text="Typed signature" />
        <Ready ok={p.attested} text="Practitioner attestation" />
        <Ready
          ok={pendingOrganizations.length > 0}
          text={`${pendingOrganizations.length} new organization${pendingOrganizations.length > 1 ? 's' : ''} selected`}
        />
        {missing.length > 0 && (
          <button
            className="secondary-button w-full"
            onClick={() => go('onboarding', p.id)}
          >
            Complete missing items
          </button>
        )}
        <button
          className="primary-button w-full"
          disabled={missing.length > 0 || !p.attested || !p.attestedBy?.trim()}
          onClick={submit}
        >
          Submit to {pendingOrganizations.length} new organization
          {pendingOrganizations.length > 1 ? 's' : ''}
          <ArrowRight size={13} />
        </button>
        <p>
          No application is sent to a real payer or healthcare organization.
        </p>
      </aside>
    </div>
  );
}

function Credentialing({
  p,
  advance,
  respond,
}: {
  p: ManagedPractitioner;
  advance: (id: string) => void;
  respond: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!p.cases.length)
    return (
      <div className="welcome-empty compact">
        <BriefcaseMedical />
        <h2>Credentialing has not started</h2>
        <p>
          Submit the completed application to create independent organization
          cases.
        </p>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="credentialing-intro">
        <div>
          <p className="eyebrow">Credentialing lifecycle</p>
          <h2>Track every organization independently</h2>
          <p>
            Use Demo Controls to progress the persisted simulation. No real
            credentialing or payer approval occurs.
          </p>
        </div>
        <Status text="Simulation mode" tone="purple" />
      </div>
      {p.cases.map((c) => {
        const org = organizations.find((o) => o.id === c.organizationId)!;
        const terminal = ['approved', 'denied'].includes(c.status),
          blocked = c.status === 'information_requested';
        return (
          <article className="surface credentialing-card" key={c.id}>
            <div className="case-top">
              <span className="org-mark">
                <Building2 size={16} />
              </span>
              <div>
                <h3>{org.name}</h3>
                <p>
                  Last updated{' '}
                  {new Date(
                    c.events.at(-1)?.at ?? p.updatedAt,
                  ).toLocaleString()}
                </p>
              </div>
              <Status
                text={caseLabels[c.status]}
                tone={
                  blocked
                    ? 'amber'
                    : c.status === 'approved'
                      ? 'green'
                      : 'purple'
                }
              />
            </div>
            {c.request && c.request.status !== 'accepted' && (
              <div className="info-request">
                <AlertCircle />
                <div>
                  <h4>{c.request.title}</h4>
                  <p>{c.request.detail}</p>
                  {c.request.status === 'open' ? (
                    <label className="primary-button">
                      Upload requested document
                      <input
                        hidden
                        type="file"
                        onChange={(e) => respond(c.id, e)}
                      />
                    </label>
                  ) : (
                    <b>Response received: {c.request.responseFile}</b>
                  )}
                </div>
              </div>
            )}
            <details open>
              <summary>
                Activity timeline <ChevronRight size={14} />
              </summary>
              <div className="timeline">
                {[...c.events].reverse().map((e, i) => (
                  <div key={e.id}>
                    <i className={i === 0 ? 'current' : ''} />
                    <b>{e.label}</b>
                    <small>
                      {new Date(e.at).toLocaleString()}
                      {e.note ? ` · ${e.note}` : ''}
                    </small>
                  </div>
                ))}
              </div>
            </details>
            <div className="demo-controls">
              <span>
                <b>Demo controls</b>
                <small>Updates this saved case and timeline</small>
              </span>
              <button
                className="secondary-button"
                disabled={blocked || terminal}
                onClick={() => advance(c.id)}
              >
                {terminal ? 'Scenario complete' : 'Advance next step'}
                <ArrowRight size={13} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
function Documents({
  p,
  upload,
}: {
  p: ManagedPractitioner;
  upload: (e: React.ChangeEvent<HTMLInputElement>, t?: string) => void;
}) {
  return (
    <section className="surface panel">
      <div className="panel-head">
        <div>
          <h2>Practitioner documents</h2>
          <p>Supporting evidence associated only with this practitioner.</p>
        </div>
        <label className="primary-button">
          <Plus size={13} />
          Upload document
          <input hidden type="file" onChange={(e) => upload(e, 'other')} />
        </label>
      </div>
      {p.documents.length ? (
        <div className="documents-table">
          {p.documents.map((d) => (
            <div key={d.id}>
              <span>
                <FileText size={17} />
              </span>
              <div>
                <b>{d.name}</b>
                <small>
                  {d.type} · {d.status}
                </small>
              </div>
              <Status text="Available" tone="green" />
            </div>
          ))}
        </div>
      ) : (
        <div className="complete-state">
          <FileText />
          No documents uploaded yet.
        </div>
      )}
    </section>
  );
}

function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav className="breadcrumb">
      {items.map((x, i) => (
        <span key={x.label}>
          {i > 0 && <ChevronRight size={12} />}
          <button disabled={!x.onClick} onClick={x.onClick}>
            {x.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select an option</option>
        {options.map((o) => (
          <option value={o} key={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Status({
  text,
  tone,
}: {
  text: string;
  tone: 'green' | 'blue' | 'amber' | 'red' | 'neutral' | 'purple';
}) {
  return <span className={`status-pill ${tone}`}>{text}</span>;
}
function Ready({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="ready-line">
      <span className={ok ? 'done' : ''}>{ok ? <Check size={11} /> : '!'}</span>
      {text}
    </div>
  );
}
function Toast({ text, close }: { text: string; close: () => void }) {
  return (
    <div className="toast">
      <CheckCircle2 size={16} />
      {text}
      <button onClick={close}>
        <X size={13} />
      </button>
    </div>
  );
}
