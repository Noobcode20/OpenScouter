import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import benchmarkData from './data/benchmark-results.json';

const metrics = [
  'Accuracy', 'Task Completion', 'Code Quality', 'Speed', 'Token Efficiency', 'Reliability',
  'Instruction Following', 'Reasoning Quality', 'Tool Efficiency', 'Error Recovery', 'Security',
  'Completeness', 'Independence', 'Context Retention', 'Hallucination Rate', 'Consistency',
];
const categories = ['All areas', 'Coding', 'Debugging', 'Code review', 'Refactoring', 'Frontend', 'Backend', 'Database', 'Architecture', 'General knowledge', 'Reasoning & logic', 'Mathematics', 'Instruction following', 'Tool use', 'Agentic tasks', 'Long context', 'Planning', 'Security'];
const initialModels = benchmarkData.models || [];
const MODELS_PER_PAGE = 10;
function modelSource(model) {
  const id = (model?.id || '').toLowerCase();
  if (id.startsWith('openrouter/')) return 'OpenRouter';
  if (id.startsWith('opencode/')) return 'OpenCode';
  if (id.startsWith('ollama/')) return 'Ollama';
  if (id.startsWith('gemini/') || id.startsWith('google/') || id.startsWith('gemini-')) return 'Gemini';
  return 'Source unknown';
}
const defaultPromptTemplate = [
  'ROLE',
  'You are a Supervisor Agent coordinating AI coding agents. Understand the objective, investigate the project, choose a practical approach, delegate where useful, and make sure the final result works. Use your judgment and involve the user when their input would materially affect the outcome.',
  'TASK',
  'Objective: ',
  'Requirements: ',
  'AVAILABLE MODELS',
  '{available_models}',
  'Use these as defaults when available; adapt to the task and available capabilities.',
  'WORKFLOW',
  'First understand the relevant code and existing behavior. Use a review agent when it will help.',
  'Delegate focused tasks with prompts grounded in what you learned: include relevant files, constraints, expected outcomes, and how the work will be checked.',
  'Use worktrees for delegated implementation so separate tasks do not interfere. Agents working together on the same feature may share a worktree. Choose task boundaries that fit the codebase; avoid splitting tightly coupled work just to add agents.',
  'Parallelize independent work when it saves time. Do dependent or overlapping work in sequence. Keep the main agent lightly involved while implementation is underway: check progress at useful milestones, step in when there is a blocker or coordination issue, and focus on review and integration when work is ready.',
  'Integrate the changes and check that they collectively meet the request. Prefer fitting the existing project over unnecessary rewrites.',
  'AUTONOMY & COMMUNICATION',
  'Work independently where reasonable. Ask about genuine ambiguity, missing information, or meaningful tradeoffs; decide minor implementation details yourself. Keep updates concise and avoid frequent status messages.',
  'VERIFICATION & QUALITY',
  'The main agent is accountable for the final result. Independently review the integrated changes and run relevant checks when appropriate. Look for incomplete or disconnected functionality, placeholders, and regressions.',
  'If something fails, investigate and try a meaningfully different fix, up to 3 attempts per issue by default. Ask for guidance if the issue remains unresolved and the user’s input would help.',
  'Never claim completion without sufficient evidence. Clearly distinguish work that is verified, unverified, partial, or blocked. Do not invent results or rely only on an agent’s claim.',
  'OUTPUT',
  'Keep the final summary concise: what changed, what was checked, whether the request is complete, and any remaining issues. Prioritize working software over elaborate planning and coordination.',
].join('\n');

function MetricBar({ label, value }) {
  const score = Number.isFinite(Number(value)) ? Number(value) : null;
  return <div className="metric-row"><span>{label}</span><b>{score == null ? '—' : `${score.toFixed(1)}/5`}</b><i><em style={{ width: `${Math.max(0, Math.min(100, (score || 0) * 20))}%` }} /></i></div>;
}

function getTextareaCaretPosition(textarea, position) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const copiedStyles = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'lineHeight',
    'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform', 'tabSize',
  ];
  copiedStyles.forEach(property => { mirror.style[property] = style[property]; });
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.height = 'auto';
  mirror.style.minHeight = '0';
  mirror.style.maxHeight = 'none';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';

  const beforeCaret = textarea.value.slice(0, position);
  mirror.append(document.createTextNode(beforeCaret));
  const caretMarker = document.createElement('span');
  caretMarker.textContent = '\u200b';
  mirror.append(caretMarker);
  textarea.parentElement.append(mirror);
  const markerRect = caretMarker.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  const result = {
    top: markerRect.bottom - textareaRect.top - textarea.scrollTop,
    left: markerRect.left - textareaRect.left - textarea.scrollLeft,
  };
  mirror.remove();
  return result;
}

function App() {
  const [models, setModels] = useState(initialModels);
  const [category, setCategory] = useState('All areas');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('overall');
  const [modelPage, setModelPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialModels[0]?.id || '');
  const [source, setSource] = useState('local');
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [activePage, setActivePage] = useState('benchmark');
  const [modelMode, setModelMode] = useState('auto');
  const [promptTemplate, setPromptTemplate] = useState(defaultPromptTemplate);
  const [codingModelId, setCodingModelId] = useState('opencode/beam-free');
  const [reviewModelId, setReviewModelId] = useState('openrouter/nvidia/nemotron-3.5-super-vl:free');
  const [additionalModelIds, setAdditionalModelIds] = useState([]);
  const [newModelId, setNewModelId] = useState('');
  const [supervisorModel, setSupervisorModel] = useState('Current model');
  const [roles, setRoles] = useState([{ id: 'coding', name: 'Coding' }, { id: 'review', name: 'Review' }]);
  const [newRole, setNewRole] = useState('');
  const [copyState, setCopyState] = useState('');
  const [placeholderContext, setPlaceholderContext] = useState(null);
  const [activePlaceholderIndex, setActivePlaceholderIndex] = useState(0);
  const promptTextareaRef = useRef(null);

  useLayoutEffect(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const resizeToContent = () => {
      textarea.style.height = 'auto';
      const style = window.getComputedStyle(textarea);
      const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      textarea.style.height = `${textarea.scrollHeight + borders}px`;
    };
    resizeToContent();
    window.addEventListener('resize', resizeToContent);
    return () => window.removeEventListener('resize', resizeToContent);
  }, [promptTemplate, activePage]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    async function loadLatest() {
      setLoading(true);
      try {
        const { data: sessions, error: sessionError } = await supabase
          .from('test_sessions').select('id, label, task, created_at, benchmark_version')
          .eq('is_published', true).order('created_at', { ascending: false }).limit(12);
        if (!active) return;
        if (sessionError) {
          setSyncMessage('Supabase sync failed; showing bundled benchmark results.');
          setLoading(false);
          return;
        }
        if (!sessions?.length) {
          setSyncMessage('No published Supabase results; showing bundled benchmark results.');
          setLoading(false);
          return;
        }
        const { data: results, error } = await supabase.from('model_results')
          .select('id, session_id, model_id, model_name, provider, status, latency_ms, scorecard_json, summary, strengths, limitations, best_for, availability_note')
          .in('session_id', sessions.map(session => session.id)).order('created_at', { ascending: true });
        if (!active) return;
        if (error) {
          setSyncMessage('Supabase sync failed; showing bundled benchmark results.');
          setLoading(false);
          return;
        }
        if (results?.length) {
          const latestSession = sessions[0];
          const rows = results.filter(row => row.session_id === latestSession.id).map(row => {
            const scores = row.scorecard_json || {};
            const scoreValues = metrics.map(metric => Number(scores[metric]?.score ?? scores[metric])).filter(Number.isFinite);
            return {
              id: row.model_id,
              name: row.model_name,
              provider: row.provider,
              status: row.status === 'error' ? 'failed' : row.status,
              latencyMs: row.latency_ms,
              scores,
              overall: scoreValues.length ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length : undefined,
              summary: row.summary || '',
              strengths: row.strengths || [],
              limitations: row.limitations || [],
              bestFor: row.best_for || [],
              categories: row.best_for || [],
              areaScores: {},
              availabilityNote: row.availability_note || '',
            };
          });
          if (rows.length) { setModels(rows); setSelectedId(rows[0].id); setSource('supabase'); setSyncMessage(''); }
          else setSyncMessage('The latest Supabase session has no results; showing bundled benchmark results.');
        } else {
          setSyncMessage('The latest Supabase session has no results; showing bundled benchmark results.');
        }
        setLoading(false);
      } catch {
        if (active) {
          setSyncMessage('Supabase sync failed; showing bundled benchmark results.');
          setLoading(false);
        }
      }
    }
    loadLatest();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => models.filter(model => {
    const text = `${model.name} ${model.provider} ${model.id}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const matchesCategory = category === 'All areas' || (model.bestFor || []).some(item => item.toLowerCase() === category.toLowerCase()) || (model.categories || []).some(item => item.toLowerCase() === category.toLowerCase());
    return matchesSearch && matchesCategory;
  }).sort((a, b) => sort === 'speed' ? (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity) : sort === 'completion' ? (Number(b.scores?.['Task Completion']?.score ?? b.scores?.['Task Completion'] ?? -1)) - (Number(a.scores?.['Task Completion']?.score ?? a.scores?.['Task Completion'] ?? -1)) : (b.overall ?? 0) - (a.overall ?? 0)), [models, category, search, sort]);
  const pageCount = Math.ceil(visible.length / MODELS_PER_PAGE);
  const currentModelPage = Math.min(modelPage, Math.max(pageCount, 1));
  const pageModels = visible.slice((currentModelPage - 1) * MODELS_PER_PAGE, currentModelPage * MODELS_PER_PAGE);
  useEffect(() => setModelPage(1), [category, search, sort]);
  useEffect(() => {
    if (modelPage > Math.max(pageCount, 1)) setModelPage(Math.max(pageCount, 1));
  }, [modelPage, pageCount]);
  const selected = models.find(model => model.id === selectedId) || visible[0] || null;
  const availableModels = models.filter(model => model.status === 'success').sort((a, b) => (b.overall || 0) - (a.overall || 0));
  const autoModel = [...availableModels].sort((a, b) => (b.overall || 0) - (a.overall || 0) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))[0];
  const areaScore = (model, area) => {
    const entry = Object.entries(model.areaScores || {}).find(([name]) => name.toLowerCase() === area.toLowerCase());
    return entry ? Number(entry[1]) : null;
  };
  const bestModelForArea = area => [...availableModels].sort((a, b) => {
    const aScore = areaScore(a, area);
    const bScore = areaScore(b, area);
    if (aScore != null || bScore != null) return (bScore ?? -1) - (aScore ?? -1) || (b.overall || 0) - (a.overall || 0) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
    return (b.overall || 0) - (a.overall || 0) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
  })[0] || autoModel;
  const autoCodingModel = bestModelForArea('Coding');
  const autoReviewModel = bestModelForArea('Code review');
  const codingModel = modelMode === 'auto' ? autoCodingModel : availableModels.find(model => model.id === codingModelId) || autoCodingModel;
  const reviewModel = modelMode === 'auto' ? autoReviewModel : availableModels.find(model => model.id === reviewModelId) || autoReviewModel;
  const additionalModels = additionalModelIds.map(id => availableModels.find(model => model.id === id)).filter(Boolean);
  const assignedModelIds = new Set(roles.filter(role => role.modelId).map(role => role.modelId));
  const roleAssignments = roles.map(role => {
    const matching = availableModels.filter(model => [...(model.bestFor || []), ...(model.categories || [])].some(item => item.toLowerCase() === role.name.toLowerCase()));
    const rankedForRole = [...availableModels].sort((a, b) => {
      const aScore = areaScore(a, role.name);
      const bScore = areaScore(b, role.name);
      if (aScore != null || bScore != null) return (bScore ?? -1) - (aScore ?? -1) || (b.overall || 0) - (a.overall || 0) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
      const aMatches = matching.includes(a);
      const bMatches = matching.includes(b);
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
      return (b.overall || 0) - (a.overall || 0) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
    });
    const bestForRole = rankedForRole.find(model => !assignedModelIds.has(model.id)) || rankedForRole[0] || autoModel;
    const assignedModel = role.modelId ? models.find(model => model.id === role.modelId) : bestForRole;
    if (assignedModel) assignedModelIds.add(assignedModel.id);
    return { ...role, model: assignedModel, automatic: !role.modelId, hasRoleEvidence: matching.length > 0 };
  });
  const promptVariables = {
    coding_model: codingModel?.id || '{coding_model}',
    coding_model_name: codingModel?.name || '{coding_model_name}',
    coding_provider: codingModel?.provider || '{coding_provider}',
    review_model: reviewModel?.id || '{review_model}',
    review_model_name: reviewModel?.name || '{review_model_name}',
    review_provider: reviewModel?.provider || '{review_provider}',
    supervisor_model: supervisorModel.trim() || '{supervisor_model}',
    additional_models: additionalModels.length ? additionalModels.map(model => `${model.id} (${model.name} · ${model.provider})`).join('\n') : 'None selected',
    available_models: roleAssignments.length ? roleAssignments.map(role => `${role.name}: ${role.model?.id || 'No available model'}${role.model ? ` (${role.model.name} · ${role.model.provider})` : ''}`).join('\n') : 'None specified',
    model_name: codingModel?.name || '{model_name}',
    provider: codingModel?.provider || '{provider}',
  };
  const resolvedPrompt = promptTemplate.replace(/\{([a-z_]+)\}/gi, (token, key) => promptVariables[key] ?? token);
  const placeholderDescriptions = {
    available_models: 'Model assignments for every role',
    coding_model: 'Coding model ID',
    coding_model_name: 'Coding model name',
    coding_provider: 'Coding model provider',
    review_model: 'Review model ID',
    review_model_name: 'Review model name',
    review_provider: 'Review model provider',
    supervisor_model: 'Supervisor model name',
    additional_models: 'Additional selected models',
    model_name: 'Coding model name (shortcut)',
    provider: 'Coding provider (shortcut)',
  };
  const placeholderSuggestions = placeholderContext
    ? Object.entries(placeholderDescriptions)
      .filter(([key]) => key.includes(placeholderContext.query.toLowerCase()))
      .map(([key, description]) => ({ key, description }))
    : [];
  const successful = models.filter(model => model.status === 'success').length;
  const mean = successful ? models.filter(model => model.status === 'success').reduce((sum, model) => sum + (model.overall || 0), 0) / successful : 0;

  async function copyPrompt() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(resolvedPrompt);
      else throw new Error('Clipboard API unavailable');
      setCopyState('Copied prompt');
    } catch {
      const field = document.createElement('textarea');
      field.value = resolvedPrompt;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      setCopyState(copied ? 'Copied prompt' : 'Copy failed — select and copy the prompt text');
    }
    window.setTimeout(() => setCopyState(''), 2600);
  }

  function updatePlaceholderContext(event) {
    const { value, selectionStart } = event.target;
    const beforeCaret = value.slice(0, selectionStart);
    const match = beforeCaret.match(/\{([a-z_]*)$/i);
    if (!match) {
      setPlaceholderContext(null);
      setActivePlaceholderIndex(0);
      return;
    }
    setPlaceholderContext({
      start: match.index,
      query: match[1],
      position: getTextareaCaretPosition(event.target, match.index + 1),
    });
    setActivePlaceholderIndex(0);
  }

  function insertPlaceholder(key) {
    const textarea = promptTextareaRef.current;
    if (!textarea || !placeholderContext) return;
    const start = placeholderContext.start;
    const end = textarea.selectionEnd;
    const insertion = `{${key}}`;
    const nextTemplate = promptTemplate.slice(0, start) + insertion + promptTemplate.slice(end);
    const nextCaret = start + insertion.length;
    setPromptTemplate(nextTemplate);
    setCopyState('');
    setPlaceholderContext(null);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleTemplateKeyDown(event) {
    if (!placeholderSuggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActivePlaceholderIndex(index => (index + direction + placeholderSuggestions.length) % placeholderSuggestions.length);
    } else if ((event.key === 'Enter' || event.key === 'Tab') && placeholderSuggestions[activePlaceholderIndex]) {
      event.preventDefault();
      insertPlaceholder(placeholderSuggestions[activePlaceholderIndex].key);
    } else if (event.key === 'Escape') {
      setPlaceholderContext(null);
    }
  }

  return <div className="scout-shell">
    <aside className="scout-sidebar">
      <a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>open<span className="brand-light">scouter</span></span></a>
      <div className="side-label">WORKSPACE</div>
      <nav className="scout-nav" aria-label="OpenScouter pages">
        <button className={activePage === 'benchmark' ? 'active' : ''} onClick={() => setActivePage('benchmark')}><span>◫</span> Model benchmark</button>
        <button className={activePage === 'prompt' ? 'active' : ''} onClick={() => setActivePage('prompt')}><span>⌘</span> Prompt builder</button>
      </nav>
      <div className="sidebar-summary"><b>{models.length}</b><span>free model entries</span></div>
      <div className="sidebar-summary"><b>{successful}/{models.length}</b><span>completed the battery</span></div>
      <div className="sidebar-bottom scout-side-note">Each model received the same three-part task. Provider errors are kept separate from answer quality.</div>
    </aside>
    <main className="scout-main" id="top">
      <header className="topbar"><div className="breadcrumb">OpenScouter <span>/</span> <b>{activePage === 'prompt' ? 'Prompt builder' : 'Free model benchmark'}</b></div><div className="top-actions"><span className="snapshot" title={syncMessage || undefined}><span className="live-dot" /> {loading ? 'Syncing results' : source === 'supabase' ? 'Supabase results' : syncMessage || 'Local benchmark results'}</span></div></header>
      {activePage === 'prompt' ? <section className="prompt-page">
        <div className="prompt-page-heading"><div><div className="section-kicker">PROMPT WORKSPACE</div><h1>Build a supervisor prompt</h1><p>Use benchmark recommendations automatically or choose the models yourself.</p></div></div>
        <div className="prompt-page-grid">
          <div className="prompt-settings">
            <div className="prompt-section-head"><div><div className="section-kicker">ROLE SELECTION</div><h2>Add roles and auto-assign models</h2></div></div>
            <p className="prompt-helper">Auto uses the strongest completed result for a matching role area. If that area has not been tested, it falls back to the strongest completed overall result. You can also choose any catalog model manually.</p>
            <div className="role-list">{roleAssignments.map(role => <div className="role-row" key={role.id}><div className="role-label"><b>{role.name}</b><small>{role.model ? `${role.model.name} · ${role.model.provider}` : 'No model available'}</small></div><select aria-label={`${role.name} model`} value={role.automatic ? '' : role.modelId} onChange={event => setRoles(items => items.map(item => item.id === role.id ? { ...item, modelId: event.target.value || undefined } : item))}><option value="">Auto</option>{models.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id}{model.status === 'success' ? '' : ' (no completed test)'}</option>)}</select><button aria-label={`Remove ${role.name} role`} onClick={() => setRoles(items => items.filter(item => item.id !== role.id))}>×</button></div>)}</div>
            <div className="add-model-row"><select aria-label="Role to add" value={newRole} onChange={event => setNewRole(event.target.value)}><option value="">Choose a role…</option>{categories.slice(1).filter(name => !roles.some(role => role.name.toLowerCase() === name.toLowerCase())).map(name => <option key={name} value={name}>{name}</option>)}</select><button onClick={() => { if (newRole) { setRoles(items => [...items, { id: `${Date.now()}-${newRole.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: newRole }]); setNewRole(''); } }} disabled={!newRole}>+ Add role</button></div>
            <div className="prompt-default-actions"><button className="prompt-reset" onClick={() => { setPromptTemplate(defaultPromptTemplate); setRoles([{ id: 'coding', name: 'Coding' }, { id: 'review', name: 'Review' }]); setNewRole(''); setModelMode('auto'); setCodingModelId(''); setReviewModelId(''); setAdditionalModelIds([]); setSupervisorModel('Current model'); setCopyState(''); }}>Use recommended defaults</button></div>
          </div>
          <div className="prompt-editor-panel"><div className="prompt-section-head"><div><div className="section-kicker">PROMPT TEMPLATE</div><h2>Edit before copying</h2></div><button className={`prompt-copy${copyState === 'Copied prompt' ? ' copied' : ''}`} onClick={copyPrompt} aria-label={copyState === 'Copied prompt' ? 'Prompt copied' : 'Copy prompt'}><span className="copy-icon" aria-hidden="true">{copyState === 'Copied prompt' ? '✓' : '⧉'}</span><span>{copyState === 'Copied prompt' ? 'Copied!' : 'Copy prompt'}</span></button></div><p className="prompt-helper">Model placeholders are filled in when copied. Type <code>{'{'}</code> to insert a placeholder.</p><div className="prompt-template-wrap"><textarea ref={promptTextareaRef} id="supervisor-prompt-template" className="prompt-template" value={promptTemplate} onChange={event => { setPromptTemplate(event.target.value); setCopyState(''); updatePlaceholderContext(event); }} onKeyDown={handleTemplateKeyDown} aria-autocomplete="list" aria-expanded={placeholderSuggestions.length > 0} aria-controls="placeholder-suggestions" spellCheck="false" />{placeholderSuggestions.length > 0 && <div className="placeholder-suggestions" id="placeholder-suggestions" role="listbox" aria-label="Available prompt placeholders" style={{ top: `${placeholderContext.position.top}px`, left: `${Math.max(0, Math.min(placeholderContext.position.left, promptTextareaRef.current?.clientWidth - 378 || 0))}px` }}>{placeholderSuggestions.map((suggestion, index) => <button type="button" key={suggestion.key} role="option" aria-selected={index === activePlaceholderIndex} className={index === activePlaceholderIndex ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => insertPlaceholder(suggestion.key)}><code>{`{${suggestion.key}}`}</code><span>{suggestion.description}</span></button>)}</div>}</div><div className="prompt-builder-foot"><span>{copyState || 'Task fields stay as {task} and {requirements}.'}</span><span>Tokens: {`{available_models}`}</span></div></div>
        </div>
      </section> : <>
      <section className="scout-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> OPEN CODE · FREE MODELS <span className="issue">BENCHMARK 01</span></div><h1>Find the model that<br /><em>does your kind of work.</em></h1><p>23 catalog entries tested with identical coding, reasoning, and security tasks. Scores use the evidence returned by each run.</p></div><div className="intro-side"><div className="signal-label">RUN SUMMARY <span>01</span></div><div className="summary-stats"><div><b>{successful}</b><span>completed</span></div><div><b>{models.length - successful}</b><span>unavailable / incomplete</span></div><div><b>{mean.toFixed(1)}</b><span>mean score / 5</span></div></div></div></section>
      <section className="bench-board">
        <div className="bench-head"><div><div className="section-kicker">MODEL RESULTS</div><h2>Performance by area</h2></div><div className="bench-controls"><label className="search-box"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search models…" aria-label="Search models" /></label><select aria-label="Sort models" value={sort} onChange={event => setSort(event.target.value)}><option value="overall">Sort: Overall score</option><option value="completion">Sort: Task completion</option><option value="speed">Sort: Speed</option></select></div></div>
        <div className="category-tabs" aria-label="Filter by category">{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="benchmark-layout">
          <div className="benchmark-table-wrap"><table className="benchmark-table"><thead><tr><th>MODEL</th><th>OVERALL</th><th>BEST FIT</th><th>RUN</th><th>DETAIL</th></tr></thead><tbody>{pageModels.map((model, index) => <tr key={model.id} className={model.id === selected?.id ? 'selected' : ''} onClick={() => setSelectedId(model.id)}><td><div className="bench-model"><span className="model-rank">{String((currentModelPage - 1) * MODELS_PER_PAGE + index + 1).padStart(2, '0')}</span><div><b>{model.name}</b><span className={`model-provider source-${modelSource(model).toLowerCase().replace(/\s+/g, '-')}`}><span className="provider-dot" />{modelSource(model)}</span><small>{model.id}</small></div></div></td><td>{model.status === 'success' ? <><b className="score-number">{Number(model.overall || 0).toFixed(1)}</b><small className="score-outof">/ 5</small></> : <span className="not-scored">Not scored</span>}</td><td><span className="best-fit">{(model.bestFor || []).slice(0, 2).join(' · ') || '—'}</span></td><td><span className={`status-pill ${model.status}`}>{model.status === 'success' ? 'Complete' : model.status === 'failed' ? 'Unavailable' : 'Incomplete'}</span></td><td><button className="detail-button" onClick={event => { event.stopPropagation(); setSelectedId(model.id); }}>View →</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No matching model results</strong><span>Try a different category or search.</span></div>}{pageCount > 1 && <nav className="model-pagination" aria-label="Model list pages"><span className="pagination-count">{(currentModelPage - 1) * MODELS_PER_PAGE + 1}–{Math.min(currentModelPage * MODELS_PER_PAGE, visible.length)} of {visible.length}</span><div className="pagination-buttons"><button aria-label="Previous page" disabled={currentModelPage === 1} onClick={() => setModelPage(currentModelPage - 1)}>Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(page => <button key={page} aria-label={`Page ${page}`} aria-current={page === currentModelPage ? 'page' : undefined} className={page === currentModelPage ? 'active' : ''} onClick={() => setModelPage(page)}>{page}</button>)}<button aria-label="Next page" disabled={currentModelPage === pageCount} onClick={() => setModelPage(currentModelPage + 1)}>Next</button></div></nav>}</div>
          {selected && <aside className="model-detail"><div className="detail-top"><div className="section-kicker">MODEL BRIEF</div><span className={`status-pill ${selected.status}`}>{selected.status === 'success' ? 'Complete' : selected.status === 'failed' ? 'Unavailable' : 'Incomplete'}</span></div><h3>{selected.name}</h3><div className={`detail-provider source-${modelSource(selected).toLowerCase().replace(/\s+/g, '-')}`}><span className="provider-dot" /><span className="provider-caption">SOURCE</span><strong>{modelSource(selected)}</strong></div><p className="detail-model-id">{selected.id}</p>{selected.status === 'success' ? <><div className="detail-score"><b>{Number(selected.overall || 0).toFixed(1)}</b><span>/ 5 overall</span>{selected.latencyMs != null && <small>{(selected.latencyMs / 1000).toFixed(1)}s</small>}</div><p className="detail-summary">{selected.summary}</p><div className="best-categories"><div className="section-kicker">STRONGEST FIT</div><div>{(selected.bestFor || []).map(item => <span key={item}>{item}</span>)}</div></div><div className="detail-columns"><div><b>Good at</b><ul>{(selected.strengths || []).map(item => <li key={item}>{item}</li>)}</ul></div><div><b>Needs work</b><ul>{(selected.limitations || []).map(item => <li key={item}>{item}</li>)}</ul></div></div><details className="score-details"><summary>All 16 scoring dimensions</summary>{metrics.map(metric => <MetricBar key={metric} label={metric} value={selected.scores?.[metric]?.score ?? selected.scores?.[metric]} />)}</details></> : <><p className="detail-summary">This catalog entry did not produce a complete benchmark response.</p><div className="availability-box"><div className="section-kicker">PROVIDER STATUS</div><p>{selected.availabilityNote || selected.summary || 'No complete result was returned.'}</p></div><div className="score-details"><div className="section-kicker">SCORING NOTE</div><p>Answer-quality scores are left blank when the model did not complete the task. This is recorded as an availability or completion issue.</p></div></>}</aside>}
        </div>
        <div className="table-foot"><span><span className="foot-dot" /> One shared battery · 3 tests · 16 scored dimensions</span><span>Catalog snapshot: 26 Oct 2026</span></div>
      </section>
      <section className="method-panel"><div><div className="section-kicker">HOW TO READ THIS</div><h3>One run is a signal, not a verdict.</h3></div><p>Successful runs were graded against explicit checks and evidence. Failed or incomplete calls are shown separately. “Best fit” reflects this battery only. Hallucination Rate is inverted (5 means fewer observed errors). Token Efficiency uses response length as a rough proxy because token telemetry was unavailable; Error Recovery was not directly tested. A single run does not measure consistency across repeated trials.</p></section>
      </>}
      <footer className="page-footer"><span>OpenScouter <span className="footer-mark">●</span> Free model field guide</span><span>Scores are based on this benchmark run</span></footer>
    </main>
  </div>;
}

export default App;
