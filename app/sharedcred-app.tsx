'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BriefcaseMedical,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Filter,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import { canonicalDegree, evaluateRequirements } from '@/lib/requirements';
import { isValidNpi } from '@/lib/npi';
import {
  organizations,
  type AccountState,
  type CaseStatus,
  type ManagedPractitioner,
  type PractitionerLookup,
} from '@/lib/domain';
import {
  createClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';

const emptyAccount: AccountState = {
  authenticated: false,
  user: null,
  practitioners: [],
  notifications: [],
};
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
const uid = () => crypto.randomUUID(),
  now = () => new Date().toISOString();
function pathFor(view: string, id?: string) {
  if (view === 'login' || view === 'signup') return `/${view}`;
  if (view === 'new') return '/practitioners/new';
  if (view === 'dashboard') return '/dashboard';
  if (id) return `/practitioners/${id}${view === 'overview' ? '' : `/${view}`}`;
  return '/dashboard';
}
function parsePath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'login' || parts[0] === 'signup')
    return { view: parts[0], id: '' };
  if (parts[0] === 'practitioners' && parts[1] === 'new')
    return { view: 'new', id: '' };
  if (parts[0] === 'practitioners' && parts[1])
    return { view: parts[2] || 'overview', id: parts[1] };
  return { view: 'dashboard', id: '' };
}

export default function SharedCredApp() {
  const [account, setAccount] = useState<AccountState>(emptyAccount),
    [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
      null,
    ),
    [configurationError, setConfigurationError] = useState(false),
    [ready, setReady] = useState(false),
    [workspaceLoaded, setWorkspaceLoaded] = useState(false),
    [route, setRoute] = useState({ view: 'dashboard', id: '' }),
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
          if (active) setAccount({ ...saved, authenticated: true });
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
  function go(view: string, id = '') {
    const path = pathFor(view, id);
    history.pushState({}, '', path);
    setRoute({ view, id });
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  function savePractitioner(next: ManagedPractitioner) {
    setAccount((a) => ({
      ...a,
      practitioners: a.practitioners.map((p) => (p.id === next.id ? next : p)),
    }));
  }
  async function authenticate(
    mode: string,
    fullName: string,
    email: string,
    password: string,
  ) {
    if (!supabase)
      return 'Supabase is not configured for this deployment yet.';
    const result =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: `${location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return result.error.message;
    if (mode === 'signup' && !result.data.session)
      return 'Check your email to confirm your account, then sign in.';
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    const saved = response.ok
      ? ((await response.json()) as AccountState)
      : { ...emptyAccount, authenticated: true, user: { fullName, email } };
    setAccount({
      ...saved,
      authenticated: true,
      user: { fullName: saved.user?.fullName ?? fullName, email },
    });
    setWorkspaceLoaded(true);
    go(saved.practitioners.length ? 'dashboard' : 'new');
    setToast('Welcome to your SharedCred workspace.');
    return null;
  }
  const practitioner = account.practitioners.find((p) => p.id === route.id);
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-[var(--teal)]" />
      </div>
    );
  if (configurationError)
    return (
      <main className="auth-page">
        <section className="auth-brand">
          <span className="brand-large">
            <ShieldCheck />
          </span>
          <p>CertifyOS SharedCred</p>
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
      <div className="mx-auto max-w-[1240px] px-5 py-8 lg:px-8">
        {route.view === 'dashboard' && <Dashboard account={account} go={go} />}{' '}
        {route.view === 'new' && (
          <NewPractitioner
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
        <span className="brand-large">
          <ShieldCheck />
        </span>
        <p>CertifyOS SharedCred</p>
        <h1>
          One professional profile.
          <br />
          Every credentialing journey.
        </h1>
        <p>
          Manage practitioners, complete applications, and follow every
          organization’s progress from one calm workspace.
        </p>
        <small>
          Independent concept prototype · Fictional organizations and simulated
          credentialing outcomes
        </small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-mobile">
            <ShieldCheck size={20} />
            <b>SharedCred</b>
          </div>
          <p className="eyebrow">
            {signup ? 'Create your workspace' : 'Welcome back'}
          </p>
          <h2>{signup ? 'Get started' : 'Sign in to SharedCred'}</h2>
          <p className="description text-xs">
            {signup
              ? 'Add your first practitioner in the next step.'
              : 'Continue managing practitioner applications.'}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <Field label="Full name">
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </Field>
            )}
            <Field label="Email">
              <input
                className="input w-full"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className="input w-full"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </Field>
            {error && (
              <div className="error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button
              className="primary-button w-full"
              type="submit"
              disabled={busy}
            >
              {busy && <LoaderCircle size={14} className="animate-spin" />}
              {signup ? 'Create account' : 'Sign in'}
              <ArrowRight size={14} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to SharedCred?'}{' '}
            <button onClick={() => go(signup ? 'login' : 'signup')}>
              {signup ? 'Sign in' : 'Create account'}
            </button>
          </p>
          <p className="demo-note">
            Secure authentication and sessions are provided by Supabase.
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
  go: (v: string, id?: string) => void;
  logout: () => void | Promise<void>;
}) {
  return (
    <header className="app-header">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <button className="logo" onClick={() => go('dashboard')}>
          <span className="brand">
            <ShieldCheck size={19} />
          </span>
          <span>
            <b>CertifyOS</b>
            <small>SharedCred</small>
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
}: {
  account: AccountState;
  go: (v: string, id?: string) => void;
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
        (filter === 'in_progress' && !p.submittedAt) ||
        (filter === 'credentialing' &&
          p.cases.some((c) => !['approved', 'denied'].includes(c.status))),
    );
  const action = account.practitioners.filter((p) =>
      p.cases.some((c) => c.status === 'information_requested'),
    ).length,
    inProgress = account.practitioners.filter((p) => !p.submittedAt).length,
    credentialing = account.practitioners.filter((p) =>
      p.cases.some((c) => !['approved', 'denied'].includes(c.status)),
    ).length;
  if (!account.practitioners.length)
    return (
      <div className="welcome-empty">
        <span>
          <Stethoscope />
        </span>
        <p className="eyebrow">Welcome to SharedCred</p>
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
        />
        <Metric value={inProgress} label="Applications in progress" />
        <Metric value={credentialing} label="Credentialing in progress" />
        <Metric value={action} label="Action required" attention={action > 0} />
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
          </div>
          {rows.map((p) => (
            <PractitionerRow key={p.id} p={p} go={go} />
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
  attention,
}: {
  value: number;
  label: string;
  attention?: boolean;
}) {
  return (
    <div className={`metric ${attention ? 'attention' : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
function PractitionerRow({
  p,
  go,
}: {
  p: ManagedPractitioner;
  go: (v: string, id?: string) => void;
}) {
  const req = evaluateRequirements(p),
    pct = req.length
      ? Math.round((req.filter((x) => x.satisfied).length / req.length) * 100)
      : 0,
    action = p.cases.some((c) => c.status === 'information_requested'),
    active = p.cases.some((c) => !['approved', 'denied'].includes(c.status));
  return (
    <button className="practitioner-row" onClick={() => go('overview', p.id)}>
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
            p.submittedAt
              ? 'Submitted'
              : pct === 100
                ? 'Ready for review'
                : `${pct}% complete`
          }
          tone={p.submittedAt ? 'green' : 'blue'}
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
          tone={action ? 'amber' : active ? 'blue' : 'neutral'}
        />
      </span>
      <span className="next">
        {action
          ? 'Upload document'
          : p.submittedAt
            ? 'View status'
            : 'Continue'}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

function NewPractitioner({
  account,
  setAccount,
  go,
  notify,
}: {
  account: AccountState;
  setAccount: React.Dispatch<React.SetStateAction<AccountState>>;
  go: (v: string, id?: string) => void;
  notify: (s: string) => void;
}) {
  const [npi, setNpi] = useState('1003000126'),
    [lookup, setLookup] = useState<PractitionerLookup>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [email, setEmail] = useState(''),
    [caqh, setCaqh] = useState(''),
    [selected, setSelected] = useState<string[]>(['northstar']);
  async function find() {
    setError('');
    if (!isValidNpi(npi)) {
      setError('Enter a valid 10-digit individual NPI.');
      return;
    }
    if (account.practitioners.some((p) => p.practitioner?.npi === npi)) {
      setError(
        'This practitioner is already in your workspace. Open the existing record instead.',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/npi/${npi}`),
        body = (await r.json()) as PractitionerLookup | { error: string };
      if (!r.ok || 'error' in body)
        throw new Error('error' in body ? body.error : 'Lookup failed');
      setLookup(body);
      setFirst(body.firstName);
      setLast(body.lastName);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }
  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup) {
      setError('Find and confirm the public NPI record first.');
      return;
    }
    if (!selected.length) {
      setError('Select at least one organization.');
      return;
    }
    const loc = lookup.addresses.find((a) => a.purpose === 'LOCATION'),
      cms = lookup.cms.facts.rows[0],
      id = uid();
    const p: ManagedPractitioner = {
      id,
      role: 'provider',
      practitioner: lookup,
      contactEmail: email,
      caqhId: caqh,
      selectedOrganizations: selected,
      profile: {
        ...blankProfile,
        degree: canonicalDegree(lookup.credential ?? '') ?? '',
        practiceAddress: loc
          ? `${loc.line1}, ${loc.city}, ${loc.state} ${loc.postalCode}`
          : '',
        education: cms?.medicalSchool ?? '',
        graduationYear: cms?.graduationYear ?? '',
      },
      documents: [],
      attested: false,
      cases: [],
      audit: [{ action: 'Practitioner added from public NPI data', at: now() }],
      createdAt: now(),
      updatedAt: now(),
    };
    setAccount((a) => ({ ...a, practitioners: [...a.practitioners, p] }));
    notify('Practitioner added. We found the information already available.');
    go('onboarding', id);
  }
  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dashboard', onClick: () => go('dashboard') },
          { label: 'Add Practitioner' },
        ]}
      />
      <PageTitle
        title="Add Practitioner"
        description="Start with an NPI. We’ll bring in available public information before asking for anything else."
      />
      <form onSubmit={create} className="add-layout">
        <div className="space-y-5">
          <section className="surface form-section">
            <div className="section-number">1</div>
            <div className="section-content">
              <h2>Practitioner information</h2>
              <p>
                Public lookup does not establish identity or grant access to
                private data.
              </p>
              <Field label="National Provider Identifier (NPI)">
                <div className="npi-field">
                  <input
                    className="input"
                    value={npi}
                    onChange={(e) => setNpi(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={find}
                    disabled={busy}
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Search size={14} />
                    )}
                    Find practitioner
                  </button>
                </div>
              </Field>
              {error && (
                <div className="error">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              {lookup && (
                <div className="lookup-result">
                  <span>
                    <CheckCircle2 />
                  </span>
                  <div>
                    <small>Public record found</small>
                    <h3>
                      {lookup.firstName} {lookup.lastName}, {lookup.credential}
                    </h3>
                    <p>
                      {lookup.taxonomies.find((t) => t.primary)?.description ??
                        'Specialty not publicly reported'}{' '}
                      ·{' '}
                      {
                        lookup.addresses.find((a) => a.purpose === 'LOCATION')
                          ?.city
                      }
                      ,{' '}
                      {
                        lookup.addresses.find((a) => a.purpose === 'LOCATION')
                          ?.state
                      }
                    </p>
                    <b>NPI {lookup.npi}</b>
                  </div>
                </div>
              )}
              <div className="form-grid">
                <Field label="First name">
                  <input
                    className="input w-full"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className="input w-full"
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Contact email">
                  <input
                    className="input w-full"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
            </div>
          </section>
          <section className="surface form-section">
            <div className="section-number">2</div>
            <div className="section-content">
              <h2>Select organizations</h2>
              <p>Choose one or more fictional demonstration organizations.</p>
              <div className="new-orgs">
                {organizations.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      className={on ? 'selected' : ''}
                      onClick={() =>
                        setSelected((s) =>
                          on ? s.filter((x) => x !== o.id) : [...s, o.id],
                        )
                      }
                    >
                      <i>{on && <Check size={13} />}</i>
                      <span>
                        <b>{o.name}</b>
                        <small>{o.subtitle}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
        <aside className="add-summary surface">
          <h3>What happens next</h3>
          <ol>
            <li>
              <span>1</span>We save the public facts and their sources.
            </li>
            <li>
              <span>2</span>SharedCred combines the selected requirements.
            </li>
            <li>
              <span>3</span>You complete only the missing information.
            </li>
          </ol>
          <button className="primary-button w-full" type="submit">
            Add Practitioner & Continue
            <ArrowRight size={14} />
          </button>
        </aside>
      </form>
    </>
  );
}

function Workspace({
  practitioner: p,
  view,
  save,
  go,
  notify,
}: {
  practitioner: ManagedPractitioner;
  view: string;
  save: (p: ManagedPractitioner) => void;
  go: (v: string, id?: string) => void;
  notify: (s: string) => void;
}) {
  const reqs = evaluateRequirements(p),
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
  function toggleOrg(org: string) {
    const on = p.selectedOrganizations.includes(org);
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
        : 'Organization added. New requirements were calculated.',
    );
  }
  async function persistDocument(file: File) {
    const form = new FormData();
    form.set('file', file);
    form.set('practitionerId', p.id);
    const response = await fetch('/api/documents', { method: 'POST', body: form });
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
      notify(error instanceof Error ? error.message : 'Document upload failed.');
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
    if (missing.length || !p.attested) return;
    const at = now();
    save({
      ...p,
      submittedAt: at,
      cases: p.selectedOrganizations.map((organizationId) => ({
        id: uid(),
        organizationId,
        status: 'submitted',
        events: [
          {
            id: uid(),
            label: 'Application submitted',
            at,
            visibleToProvider: true,
            note: 'Credentialing simulation ready to begin.',
          },
        ],
      })),
      updatedAt: at,
    });
    notify(
      'Application submitted to all selected demonstration organizations.',
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
      notify(error instanceof Error ? error.message : 'Document upload failed.');
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
          {!p.submittedAt && (
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
          {p.submittedAt && (
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
          p={p}
          reqs={reqs}
          update={updateProfile}
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
  go: (v: string, id?: string) => void;
  toggleOrg: (id: string) => void;
}) {
  const facts = p.practitioner?.nppes.facts.factCount ?? 0;
  return (
    <div className="overview-grid">
      <div className="space-y-5">
        <section className="surface readiness-card">
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
            className="ring"
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
                <button key={r.id} onClick={() => go('onboarding', p.id)}>
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
                const orgReq = reqs.filter((r) =>
                    r.organizationIds.includes(o.id),
                  ),
                  left = orgReq.filter((r) => !r.satisfied).length;
                return (
                  <div key={o.id}>
                    <span className="org-mark">
                      <Building2 size={15} />
                    </span>
                    <div>
                      <b>{o.name}</b>
                      <small>
                        {left
                          ? `${left} missing requirement${left > 1 ? 's' : ''}`
                          : 'Ready for submission'}
                      </small>
                    </div>
                    <Status
                      text={left ? 'In progress' : 'Ready'}
                      tone={left ? 'blue' : 'green'}
                    />
                  </div>
                );
              })}
          </div>
        </section>
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
            {organizations.map((o) => {
              const on = p.selectedOrganizations.includes(o.id);
              return (
                <button
                  disabled={on}
                  onClick={() => toggleOrg(o.id)}
                  key={o.id}
                >
                  <Building2 size={15} />
                  <span>
                    <b>{o.name}</b>
                    <small>
                      {on ? 'Already added' : 'Add without restarting'}
                    </small>
                  </span>
                  {!on && <Plus size={14} />}
                </button>
              );
            })}
          </div>
        </section>
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

function Onboarding({
  p,
  reqs,
  update,
  upload,
  go,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  update: (k: keyof ManagedPractitioner['profile'], v: string) => void;
  upload: (e: React.ChangeEvent<HTMLInputElement>, t?: string) => void;
  go: (v: string, id?: string) => void;
}) {
  const missing = reqs.filter((r) => !r.satisfied),
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
        {[
          'Professional details',
          'Education',
          'License',
          'Practice',
          'Affiliations',
          'Coverage',
          'Documents',
          'Disclosures',
        ].map((section) => {
          const done = !reqs.some(
            (r) => r.category === section && !r.satisfied,
          );
          return (
            <div key={section} className={done ? 'done' : ''}>
              <span>{done ? <Check size={11} /> : ''}</span>
              {section}
            </div>
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
              We found professional information already. Review the prefilled
              values and complete the remaining requirements.
            </p>
          </div>
          <span>
            {missing.length}
            <small>items left</small>
          </span>
        </section>
        <section className="surface panel">
          <h2>Professional information</h2>
          <p className="panel-copy">
            Dropdown fields use approved example values. Free text is reserved
            for genuinely open-ended data.
          </p>
          <div className="form-grid">
            <SelectField
              label="Professional degree"
              value={p.profile.degree}
              options={degreeOptions}
              onChange={(v) => update('degree', v)}
            />
            <SelectField
              label="License state"
              value={p.profile.licenseState}
              options={stateOptions}
              onChange={(v) => update('licenseState', v)}
            />
            <Field label="License number">
              <input
                className="input w-full"
                value={p.profile.licenseNumber}
                onChange={(e) => update('licenseNumber', e.target.value)}
                placeholder="Enter license number"
              />
            </Field>
            <SelectField
              label="Graduation year"
              value={p.profile.graduationYear}
              options={yearOptions}
              onChange={(v) => update('graduationYear', v)}
            />
            <Field label="Medical school">
              <input
                className="input w-full"
                value={p.profile.education}
                onChange={(e) => update('education', e.target.value)}
                placeholder="Institution name"
              />
            </Field>
            <Field label="Primary practice address">
              <input
                className="input w-full"
                value={p.profile.practiceAddress}
                onChange={(e) => update('practiceAddress', e.target.value)}
                placeholder="Street, city, state, ZIP"
              />
            </Field>
            {p.selectedOrganizations.includes('evergreen') && (
              <>
                <SelectField
                  label="Hospital affiliation"
                  value={p.profile.hospitalAffiliation}
                  options={hospitals}
                  onChange={(v) => update('hospitalAffiliation', v)}
                />
                <SelectField
                  label="Malpractice carrier"
                  value={p.profile.malpracticeCarrier}
                  options={carriers}
                  onChange={(v) => update('malpracticeCarrier', v)}
                />
                <SelectField
                  label="Professional disclosure"
                  value={p.profile.disclosure}
                  options={[
                    'No — no reportable events',
                    'Yes — explanation required',
                  ]}
                  onChange={(v) => update('disclosure', v)}
                />
              </>
            )}
          </div>
        </section>
        <section className="surface panel">
          <h2>Supporting documents</h2>
          <p className="panel-copy">
            Upload demonstration documents only. Uploaded evidence is not
            automatically verified.
          </p>
          <label className="upload">
            <Upload size={16} />
            Upload license document
            <input hidden type="file" onChange={(e) => upload(e, 'license')} />
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
        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={() => go('overview', p.id)}
          >
            Save & Exit
          </button>
          <button
            className="primary-button"
            onClick={() => go('application', p.id)}
          >
            Continue to Application
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Application({
  p,
  reqs,
  missing,
  save,
  submit,
  go,
}: {
  p: ManagedPractitioner;
  reqs: ReturnType<typeof evaluateRequirements>;
  missing: ReturnType<typeof evaluateRequirements>;
  save: (p: ManagedPractitioner) => void;
  submit: () => void;
  go: (v: string, id?: string) => void;
}) {
  if (p.submittedAt)
    return (
      <section className="surface submitted-snapshot">
        <CheckCircle2 />
        <p className="eyebrow">Application submitted</p>
        <h2>Submitted {new Date(p.submittedAt).toLocaleString()}</h2>
        <p>
          This read-only view preserves the professional information and
          organization requirement versions used at submission.
        </p>
        <div>
          {p.selectedOrganizations.map((id) => (
            <span key={id}>{organizations.find((o) => o.id === id)?.name}</span>
          ))}
        </div>
        <button
          className="primary-button"
          onClick={() => go('credentialing', p.id)}
        >
          View Credentialing
        </button>
      </section>
    );
  return (
    <div className="review-layout">
      <section className="surface panel">
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
        <dl className="review-list">
          {[
            [
              'Practitioner',
              `${p.practitioner?.firstName} ${p.practitioner?.lastName}`,
            ],
            ['NPI', p.practitioner?.npi],
            ['Professional degree', p.profile.degree],
            ['Medical school', p.profile.education],
            ['Graduation year', p.profile.graduationYear],
            [
              'State license',
              p.profile.licenseNumber
                ? `${p.profile.licenseState} ${p.profile.licenseNumber}`
                : 'Not provided',
            ],
            ['Practice address', p.profile.practiceAddress],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
        <div className="selected-org-list">
          <h3>Selected organizations</h3>
          {p.selectedOrganizations.map((id) => (
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
        <label className="attestation">
          <input
            type="checkbox"
            checked={p.attested}
            onChange={(e) =>
              save({ ...p, attested: e.target.checked, updatedAt: now() })
            }
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
      </section>
      <aside className="surface submit-panel">
        <h3>Submission readiness</h3>
        <Ready
          ok={missing.length === 0}
          text={`${missing.length} unresolved requirements`}
        />
        <Ready
          ok={p.documents.some((d) => d.type === 'license')}
          text="License document"
        />
        <Ready ok={p.attested} text="Practitioner attestation" />
        <Ready
          ok={p.selectedOrganizations.length > 0}
          text={`${p.selectedOrganizations.length} organizations selected`}
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
          disabled={missing.length > 0 || !p.attested}
          onClick={submit}
        >
          Submit to {p.selectedOrganizations.length} organizations
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
  tone: 'green' | 'blue' | 'amber' | 'neutral' | 'purple';
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
