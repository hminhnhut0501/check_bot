'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Group = { id: string; telegram_chat_id: string; title: string; username?: string | null; status: string };
type GroupSettings = {
  group_id: string;
  moderation_enabled: boolean;
  welcome_enabled: boolean;
  join_gate_enabled: boolean;
  delete_link_enabled: boolean;
  delete_keyword_enabled: boolean;
  auto_restrict_enabled: boolean;
  config_json: Record<string, unknown>;
};
type Member = { telegram_user_id: string; username?: string | null; display_name?: string | null; status: string; last_seen_at?: string | null };
type Rule = { id: string; rule_type: string; pattern: string; action: string; severity: number; enabled: boolean; priority: number };
type Audit = { id: string; action: string; resource_type: string; resource_id?: string | null; actor_type: string; actor_id?: string | null; created_at: string; new_data?: Record<string, unknown> | null };
type BlacklistItem = { id: string; item_type: string; item_value: string; reason?: string | null; status: string };
type Welcome = { id: string; variant_name: string; message_text: string; enabled: boolean };
type MemberEvent = { id: string; telegram_user_id: string; event_type: string; payload_json: Record<string, unknown>; created_at: string };

const tabs = ['settings', 'rules', 'members', 'audit'] as const;
type Tab = typeof tabs[number];

export default function GroupBotAdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupDetail, setGroupDetail] = useState<{ group: Group; settings: GroupSettings | null; members: Member[]; rules: Rule[]; audit: Audit[]; blacklist: BlacklistItem[]; welcome: Welcome[]; member_events: MemberEvent[] } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [itemType, setItemType] = useState('keyword');
  const [itemValue, setItemValue] = useState('');
  const [welcomeText, setWelcomeText] = useState('Chào {name} vào {group}!');
  const [welcomeVariant, setWelcomeVariant] = useState('default');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [previewText, setPreviewText] = useState('Mời ghé https://spam.test');
  const [previewUserId, setPreviewUserId] = useState('123456');
  const [previewUsername, setPreviewUsername] = useState('@demo_spam');
  const [previewDecision, setPreviewDecision] = useState('');
  const [ruleForm, setRuleForm] = useState({ rule_type: 'keyword', pattern: '', action: 'delete', severity: '1', priority: '100' });
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [message, setMessage] = useState('');

  async function authHeaders() {
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    return { authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }

  async function loadGroups() {
    const response = await fetch('/api/admin/group-bot/groups', { headers: await authHeaders() });
    const result = await response.json();
    setGroups(result.groups ?? []);
    if (!selectedGroupId && result.groups?.length) setSelectedGroupId(result.groups[0].id);
  }

  async function loadDetail(groupId: string) {
    const response = await fetch(`/api/admin/group-bot/groups/${groupId}`, { headers: await authHeaders() });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không tải được group');
    setGroupDetail(result);
  }

  useEffect(() => { void loadGroups(); }, []);
  useEffect(() => { if (selectedGroupId) void loadDetail(selectedGroupId); }, [selectedGroupId]);

  const currentSettings = useMemo(() => groupDetail?.settings ?? null, [groupDetail]);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/group-bot/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ telegram_chat_id: telegramChatId, title, username: username || null }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không tạo được group');
    setMessage('Đã tạo group');
    setTelegramChatId('');
    setTitle('');
    setUsername('');
    await loadGroups();
    setSelectedGroupId(result.group.id);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupDetail) return;
    const form = new FormData(event.currentTarget);
    const settings = {
      moderation_enabled: form.get('moderation_enabled') === 'on',
      welcome_enabled: form.get('welcome_enabled') === 'on',
      join_gate_enabled: form.get('join_gate_enabled') === 'on',
      delete_link_enabled: form.get('delete_link_enabled') === 'on',
      delete_keyword_enabled: form.get('delete_keyword_enabled') === 'on',
      auto_restrict_enabled: form.get('auto_restrict_enabled') === 'on',
      config_json: {
        join_gate_note: String(form.get('join_gate_note') ?? '').trim(),
        welcome_suffix: String(form.get('welcome_suffix') ?? '').trim(),
      },
    };
    const response = await fetch(`/api/admin/group-bot/groups/${groupDetail.group.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ settings }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không lưu được settings');
    setMessage('Đã lưu settings');
    setGroupDetail(result);
    await loadGroups();
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    if (!selectedGroupId) return;
    const response = await fetch('/api/admin/group-bot/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ group_id: selectedGroupId, ...ruleForm }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không thêm được rule');
    setMessage('Đã thêm rule');
    setRuleForm({ rule_type: 'keyword', pattern: '', action: 'delete', severity: '1', priority: '100' });
    await loadDetail(selectedGroupId);
  }

  async function previewRuleDecision(event: FormEvent) {
    event.preventDefault();
    if (!groupDetail) return;
    const response = await fetch('/api/admin/group-bot/rules/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        telegram_chat_id: groupDetail.group.telegram_chat_id,
        text: previewText,
        user_id: previewUserId,
        username: previewUsername,
      }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không preview được rule');
    setPreviewDecision(`${result.decision.action} · ${result.decision.reason}`);
  }

  async function addBlacklist(event: FormEvent) {
    event.preventDefault();
    if (!selectedGroupId) return;
    const response = await fetch('/api/admin/group-bot/blacklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ group_id: selectedGroupId, item_type: itemType, item_value: itemValue, reason: 'manual' }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không thêm được blacklist');
    setMessage('Đã thêm blacklist');
    setItemValue('');
    await loadDetail(selectedGroupId);
  }

  async function patchBlacklist(item: BlacklistItem, patch: Partial<BlacklistItem>) {
    const response = await fetch('/api/admin/group-bot/blacklist', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật blacklist');
    setMessage('Đã cập nhật blacklist');
    await loadDetail(selectedGroupId);
  }

  async function deleteBlacklist(id: string) {
    const response = await fetch(`/api/admin/group-bot/blacklist?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không xoá được blacklist');
    setMessage('Đã xoá blacklist');
    await loadDetail(selectedGroupId);
  }

  async function addWelcome(event: FormEvent) {
    event.preventDefault();
    if (!selectedGroupId) return;
    const response = await fetch('/api/admin/group-bot/welcome', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ group_id: selectedGroupId, message_text: welcomeText, variant_name: welcomeVariant, enabled: welcomeEnabled }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không thêm được welcome');
    setMessage('Đã thêm welcome');
    await loadDetail(selectedGroupId);
  }

  async function patchWelcome(item: Welcome, patch: Partial<Welcome>) {
    const response = await fetch('/api/admin/group-bot/welcome', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật welcome');
    setMessage('Đã cập nhật welcome');
    await loadDetail(selectedGroupId);
  }

  async function deleteWelcome(id: string) {
    const response = await fetch(`/api/admin/group-bot/welcome?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không xoá được welcome');
    setMessage('Đã xoá welcome');
    await loadDetail(selectedGroupId);
  }

  async function memberAction(userId: string, action: 'restrict' | 'ban' | 'unban') {
    if (!selectedGroupId) return;
    const response = await fetch(`/api/admin/group-bot/members/${encodeURIComponent(userId)}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ group_id: selectedGroupId, action }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật member');
    setMessage(`Đã ${action} member`);
    await loadDetail(selectedGroupId);
  }

  async function patchRule(rule: Rule, patch: Partial<Rule>) {
    const response = await fetch('/api/admin/group-bot/rules', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: rule.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật rule');
    setMessage('Đã cập nhật rule');
    await loadDetail(selectedGroupId);
  }

  async function deleteRule(id: string) {
    const response = await fetch(`/api/admin/group-bot/rules?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không xoá được rule');
    setMessage('Đã xoá rule');
    await loadDetail(selectedGroupId);
  }

  async function patchBlacklist(item: BlacklistItem, patch: Partial<BlacklistItem>) {
    const response = await fetch('/api/admin/group-bot/blacklist', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật blacklist');
    setMessage('Đã cập nhật blacklist');
    await loadDetail(selectedGroupId);
  }

  async function deleteBlacklist(id: string) {
    const response = await fetch(`/api/admin/group-bot/blacklist?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không xoá được blacklist');
    setMessage('Đã xoá blacklist');
    await loadDetail(selectedGroupId);
  }

  async function patchWelcome(item: Welcome, patch: Partial<Welcome>) {
    const response = await fetch('/api/admin/group-bot/welcome', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không cập nhật welcome');
    setMessage('Đã cập nhật welcome');
    await loadDetail(selectedGroupId);
  }

  async function deleteWelcome(id: string) {
    const response = await fetch(`/api/admin/group-bot/welcome?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'Không xoá được welcome');
    setMessage('Đã xoá welcome');
    await loadDetail(selectedGroupId);
  }

  const visibleMembers = (groupDetail?.members ?? []).filter((member) => {
    const searchable = `${member.display_name ?? ''} ${member.username ?? ''} ${member.telegram_user_id}`.toLowerCase();
    const matchesSearch = !memberSearch || searchable.includes(memberSearch.toLowerCase());
    const matchesStatus = !memberStatus || member.status === memberStatus;
    return matchesSearch && matchesStatus;
  });

  const memberEvents = (groupDetail?.member_events ?? []).filter((entry) => !selectedMemberId || entry.telegram_user_id === selectedMemberId);

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">CU BOT / GROUP CONTROL</p>
        <h1>Group Bot Admin</h1>
        <p className="muted">Dashboard vận hành cho moderation, member, blacklist, welcome và audit.</p>
      </div>
      <div className="actions">
        <a className="secondary" href="/admin/group-bot/overview">Overview</a>
        <a className="secondary" href="/">Trang chủ</a>
      </div>
    </header>

    <div className="inbox-grid">
      <section className="queue">
        <div className="section-title"><h2>Groups</h2><span>{groups.length}</span></div>
        {groups.map((group) => (
          <button key={group.id} className={`report-row ${selectedGroupId === group.id ? 'selected' : ''}`} onClick={() => setSelectedGroupId(group.id)}>
            <span><strong>{group.title}</strong><small>{group.telegram_chat_id}{group.username ? ` · @${group.username}` : ''}</small></span>
            <span className={`pill ${group.status}`}>{group.status}</span>
          </button>
        ))}

        <form onSubmit={createGroup}>
          <h3>Thêm group</h3>
          <label>Telegram chat ID<input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} required /></label>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <button>Tạo group</button>
        </form>

          <article>
            <h3>Quick tools</h3>
          <form onSubmit={addBlacklist} className="stack-form">
            <label>Loại
              <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
                <option value="keyword">keyword</option>
                <option value="phrase">phrase</option>
                <option value="user_id">user_id</option>
                <option value="username">username</option>
                <option value="domain">domain</option>
                <option value="link">link</option>
                <option value="phone">phone</option>
              </select>
            </label>
            <label>Giá trị<input value={itemValue} onChange={(e) => setItemValue(e.target.value)} required /></label>
            <button>Thêm blacklist</button>
            </form>
          <label><input type="checkbox" checked={welcomeEnabled} onChange={(e) => setWelcomeEnabled(e.target.checked)} /> Enable welcome on next add</label>
          <form onSubmit={addWelcome} className="stack-form">
            <label>Variant<input value={welcomeVariant} onChange={(e) => setWelcomeVariant(e.target.value)} /></label>
            <label><input type="checkbox" checked={welcomeEnabled} onChange={(e) => setWelcomeEnabled(e.target.checked)} /> Enabled</label>
            <label>Tin nhắn chào<textarea value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} /></label>
            <button>Thêm welcome</button>
          </form>
          <div>
            <h4>Current blacklist</h4>
            {(groupDetail?.blacklist ?? []).map((item) => (
              <div className="history" key={item.id}>
                <strong>{item.item_type}</strong> · {item.item_value}
                <small>{item.status}{item.reason ? ` · ${item.reason}` : ''}</small>
                <span className="actions">
                  <button type="button" className="secondary" onClick={() => {
                    const value = window.prompt('Value mới', item.item_value);
                    if (value !== null) void patchBlacklist(item, { item_value: value });
                  }}>Edit</button>
                  <button type="button" className="secondary" onClick={() => void patchBlacklist(item, { status: item.status === 'active' ? 'disabled' : 'active' })}>{item.status === 'active' ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="danger" onClick={() => void deleteBlacklist(item.id)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
          <div>
            <h4>Current welcomes</h4>
            {(groupDetail?.welcome ?? []).map((item) => (
              <div className="history" key={item.id}>
                <strong>{item.variant_name}</strong> · {item.message_text}
                <small>{item.enabled ? 'enabled' : 'disabled'}</small>
                <span className="actions">
                  <button type="button" className="secondary" onClick={() => {
                    const text = window.prompt('Tin nhắn mới', item.message_text);
                    if (text !== null) void patchWelcome(item, { message_text: text });
                  }}>Edit</button>
                  <button type="button" className="secondary" onClick={() => void patchWelcome(item, { enabled: !item.enabled })}>{item.enabled ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="danger" onClick={() => void deleteWelcome(item.id)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detail">
        {!groupDetail ? <div className="empty"><h2>Chọn một group</h2></div> : <>
          <div className="detail-head">
            <div>
              <p className="eyebrow">{groupDetail.group.telegram_chat_id}</p>
              <h2>{groupDetail.group.title}</h2>
              <p className="muted">{groupDetail.group.username ? `@${groupDetail.group.username}` : 'No username'} · {groupDetail.group.status}</p>
            </div>
            <div className="score">{groupDetail.members.length}<small>members</small></div>
          </div>

          <div className="toolbar">
            {tabs.map((tab) => <button key={tab} className={activeTab === tab ? '' : 'secondary'} onClick={() => setActiveTab(tab)}>{tab}</button>)}
          </div>

          {activeTab === 'settings' && (
            <form onSubmit={saveSettings}>
              <article>
                <h3>Toggle config</h3>
                <label><input type="checkbox" name="moderation_enabled" defaultChecked={currentSettings?.moderation_enabled ?? true} /> Moderation enabled</label>
                <label><input type="checkbox" name="welcome_enabled" defaultChecked={currentSettings?.welcome_enabled ?? true} /> Welcome enabled</label>
                <label><input type="checkbox" name="join_gate_enabled" defaultChecked={currentSettings?.join_gate_enabled ?? false} /> Join gate enabled</label>
                <label><input type="checkbox" name="delete_link_enabled" defaultChecked={currentSettings?.delete_link_enabled ?? true} /> Delete link messages</label>
                <label><input type="checkbox" name="delete_keyword_enabled" defaultChecked={currentSettings?.delete_keyword_enabled ?? true} /> Delete phone/keyword messages</label>
                <label><input type="checkbox" name="auto_restrict_enabled" defaultChecked={currentSettings?.auto_restrict_enabled ?? false} /> Auto restrict on rule hit</label>
                <label>Join gate note<input name="join_gate_note" defaultValue={String(currentSettings?.config_json?.join_gate_note ?? '')} /></label>
                <label>Welcome suffix<input name="welcome_suffix" defaultValue={String(currentSettings?.config_json?.welcome_suffix ?? '')} /></label>
                <button>Lưu cấu hình</button>
              </article>
            </form>
          )}

          {activeTab === 'rules' && (
            <article>
              <h3>Moderation rules</h3>
              <form onSubmit={previewRuleDecision} className="stack-form">
                <label>Preview text<textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} rows={3} /></label>
                <label>User ID<input value={previewUserId} onChange={(e) => setPreviewUserId(e.target.value)} /></label>
                <label>Username<input value={previewUsername} onChange={(e) => setPreviewUsername(e.target.value)} /></label>
                <button type="submit">Preview moderation decision</button>
                {previewDecision ? <p className="muted">Decision: {previewDecision}</p> : null}
              </form>
              {groupDetail.rules.map((rule) => (
                <div className="history" key={rule.id}>
                  <strong>{rule.rule_type}</strong> · {rule.pattern}
                  <small>{rule.action} · severity {rule.severity} · priority {rule.priority} · {rule.enabled ? 'enabled' : 'disabled'}</small>
                  <span className="actions">
                    <button className="secondary" type="button" onClick={() => void patchRule(rule, { enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="secondary" type="button" onClick={() => {
                      const pattern = window.prompt('Pattern mới', rule.pattern);
                      if (pattern !== null) void patchRule(rule, { pattern });
                    }}>Edit</button>
                    <button className="danger" type="button" onClick={() => void deleteRule(rule.id)}>Delete</button>
                  </span>
                </div>
              ))}
              <form onSubmit={addRule} className="stack-form">
                <label>Rule type
                  <select value={ruleForm.rule_type} onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}>
                    <option value="keyword">keyword</option>
                    <option value="link">link</option>
                    <option value="domain">domain</option>
                    <option value="flood">flood</option>
                    <option value="repeated_text">repeated_text</option>
                    <option value="mention">mention</option>
                    <option value="join_gate">join_gate</option>
                  </select>
                </label>
                <label>Pattern<input value={ruleForm.pattern} onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })} required /></label>
                <label>Action
                  <select value={ruleForm.action} onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}>
                    <option value="delete">delete</option>
                    <option value="warn">warn</option>
                    <option value="restrict">restrict</option>
                    <option value="ban">ban</option>
                    <option value="approve">approve</option>
                  </select>
                </label>
                <label>Severity<input type="number" min="1" max="10" value={ruleForm.severity} onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })} /></label>
                <label>Priority<input type="number" min="1" max="1000" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })} /></label>
                <button>Thêm rule</button>
              </form>
            </article>
          )}

          {activeTab === 'members' && (
            <article>
              <h3>Member list</h3>
              <div className="toolbar">
                <input placeholder="Tìm member" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                <select value={memberStatus} onChange={(e) => setMemberStatus(e.target.value)}>
                  <option value="">All status</option>
                  <option value="member">member</option>
                  <option value="restricted">restricted</option>
                  <option value="left">left</option>
                  <option value="banned">banned</option>
                </select>
              </div>
              {visibleMembers.map((member) => (
                <div className={`history ${selectedMemberId === member.telegram_user_id ? 'selected' : ''}`} key={member.telegram_user_id} onClick={() => setSelectedMemberId(member.telegram_user_id)}>
                  <strong>{member.display_name ?? member.username ?? member.telegram_user_id}</strong>
                  <small>{member.status}{member.last_seen_at ? ` · ${new Date(member.last_seen_at).toLocaleString('vi-VN')}` : ''}</small>
                  <span className="actions">
                    <button className="secondary" type="button" onClick={() => void memberAction(member.telegram_user_id, 'restrict')}>Restrict</button>
                    <button className="secondary" type="button" onClick={() => void memberAction(member.telegram_user_id, 'unban')}>Unban</button>
                    <button className="danger" type="button" onClick={() => void memberAction(member.telegram_user_id, 'ban')}>Ban</button>
                  </span>
                </div>
              ))}
              <article>
                <h4>Member history</h4>
                {memberEvents.length ? memberEvents.map((event) => <p className="history" key={event.id}><strong>{event.event_type}</strong> · {event.telegram_user_id}<small>{new Date(event.created_at).toLocaleString('vi-VN')}</small></p>) : <p className="muted">Chọn một member để xem lịch sử.</p>}
              </article>
            </article>
          )}

          {activeTab === 'audit' && (
            <article>
              <h3>Audit log</h3>
              {groupDetail.audit.map((item) => (
                <p className="history" key={item.id}>
                  <strong>{item.action}</strong> · {item.resource_type}
                  {item.resource_id ? ` · ${item.resource_id}` : ''}
                  <small>{item.actor_type}{item.actor_id ? ` · ${item.actor_id}` : ''} · {new Date(item.created_at).toLocaleString('vi-VN')}</small>
                </p>
              ))}
            </article>
          )}
        </>}
        {message && <p className="success">{message}</p>}
      </section>
    </div>
  </main>;
}
