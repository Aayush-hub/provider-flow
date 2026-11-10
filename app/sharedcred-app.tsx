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
    [selected, setSelected] = useState<string[]>([]);

  async function validateNpi() {
    setError('');
    if (!isValidNpi(npi)) {
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
        | { error: string };
      if (!response.ok || 'error' in body)
        throw new Error('error' in body ? body.error : 'Lookup failed');
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
        licenses:
          profile.licenseState || profile.licenseNumber
            ? [
                {
                  id: uid(),
                  state: profile.licenseState,
                  licenseNumber: profile.licenseNumber,
                  licenseType: profile.degree,
                  expirationDate: '',
                },
              ]
            : [],
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
        submissions: [],
        documents: [],
        attested: false,
        cases: [],
        audit: [
          { action: 'Practitioner created from public NPI data', at: now() },
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
                  <button onClick={() => setNpi('1003000126')}>
                    1003000126
                  </button>
                  .
                </p>
                {error && (
                  <div className="error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
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
                    <small>NPI record matched</small>
                    <h2>
                      {lookup.firstName} {lookup.lastName}, {lookup.credential}
                    </h2>
                    <p>
                      {primaryTaxonomy?.description ?? 'Specialty unavailable'}{' '}
                      · {location?.city}, {location?.state}
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
    save({
      ...p,
      profile: { ...p.profile, [key]: value },
      attested: false,
      updatedAt: now(),
    });
  }
  function updateHistories(histories: ProviderHistories) {
    const currentPractice = histories.practices.find((item) => item.current),
      primaryEducation = histories.education[0],
      primaryLicense = histories.licenses[0],
      currentAffiliation =
        histories.affiliations.find((item) => item.current) ??
        histories.affiliations[0];
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
      attested: false,
      updatedAt: now(),
    });
  }
  function resolveConflict(conflictId: string, optionId: string) {
    const conflict = p.dataConflicts?.find((item) => item.id === conflictId),
      option = conflict?.options.find((item) => item.id === optionId);
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
          ? { ...item, selectedOptionId: optionId, resolvedAt }
          : item,
      ),
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
    save({
      ...p,
      selectedOrganizations: on
        ? p.selectedOrganizations.filter((x) => x !== org)
        : [...p.selectedOrganizations, org],
      attested: false,
      updatedAt: now(),
    });
    notify(
      on
        ? 'Organization removed from the draft.'
        : submittedOrganizations.length
          ? 'Organization added. Only its new requirements need review.'
          : 'Organization added. New requirements were calculated.',
    );
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
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  missing: ReturnType<typeof evaluateRequirements>;
  pct: number;
  go: Navigate;
  toggleOrg: (id: string) => void;
}) {
  const facts = p.practitioner?.nppes.facts.factCount ?? 0,
    submittedOrganizations = submittedOrganizationIds(p);
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
                ? `${missing.length} items require your attention.`
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
        <section className="surface panel">
          <h2>Data acquisition</h2>
          <div className="data-stats">
            <div>
              <b>{facts}</b>
              <span>Facts acquired</span>
            </div>
            <div>
              <b>{p.audit.filter((a) => a.action.includes('reused')).length}</b>
              <span>Facts reused</span>
            </div>
            <div>
              <b>{Object.values(p.profile).filter(Boolean).length}</b>
              <span>Profile facts present</span>
            </div>
            <div>
              <b>{missing.length}</b>
              <span>Missing required</span>
            </div>
          </div>
          <p className="source-note">
            <i />
            Publicly reported information is not primary-source verification.
          </p>
        </section>
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
  go,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  initialSection?: OnboardingSection;
  update: (k: keyof ManagedPractitioner['profile'], v: string) => void;
  updateHistories: (histories: ProviderHistories) => void;
  resolveConflict: (conflictId: string, optionId: string) => void;
  upload: (e: React.ChangeEvent<HTMLInputElement>, t?: string) => void;
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
        {activeSection === 'Resolve conflicts' && (
          <section
            key={activeSection}
            className="surface panel onboarding-section conflict-section"
          >
            <p className="eyebrow">Confirm what is current</p>
            <h2>Resolve source conflicts</h2>
            <p className="panel-copy">
              We found different values across public sources. Choose the value
              that is accurate today—we will use it throughout your profile.
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
                  <PracticeHistoryEditor
                    histories={histories}
                    updateHistories={updateHistories}
                  />
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
