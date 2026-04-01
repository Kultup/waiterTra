import React from 'react';

const TemplatesPanel = ({
  templates,
  templatesOpen,
  onToggleOpen,
  multiCopyStatus,
  onCopyAllLink,
  user,
  filterCity,
  onFilterCityChange,
  cities,
  editingTemplateId,
  copyStatus,
  onImportTemplate,
  onLoadTemplate,
  onCopyLink,
  onShareTelegram,
  onExportTemplate,
  onEditTemplate,
  onDeleteTemplate,
}) => {
  const filteredTemplates = templates.filter((template) => !filterCity || template.targetCity === filterCity);

  return (
    <aside className="desk-panel templates-panel">
      <div className="panel-label templates-label" onClick={onToggleOpen}>
        <span>Шаблони</span>
        <span className="templates-toggle">{templatesOpen ? '▲' : '▼'}</span>
      </div>

      {templates.length > 0 && templatesOpen && (
        <button
          type="button"
          className={`btn-all-link ${multiCopyStatus ? 'copied' : ''}`}
          onClick={onCopyAllLink}
          title="Створити посилання на проходження всіх сервіровок"
        >
          {multiCopyStatus ? '✓ Скопійовано!' : 'Посилання на всі столи'}
        </button>
      )}

      {templatesOpen && (
        <div className="templates-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <label className="btn-all-link" style={{ flex: 1, textAlign: 'center', margin: 0, cursor: 'pointer' }}>
              Імпорт шаблону
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImportTemplate} />
            </label>
          </div>

          {user?.role === 'superadmin' && (
            <div className="city-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>Місто:</span>
              <select
                value={filterCity}
                onChange={(event) => onFilterCityChange(event.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
              >
                <option value="" style={{ color: '#000' }}>Всі міста</option>
                {cities.map((city) => (
                  <option key={city._id} value={city.name} style={{ color: '#000' }}>{city.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="templates-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
            {filteredTemplates.length === 0 ? (
              <p className="empty-msg">Немає збережених шаблонів</p>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template._id}
                  className={`template-card ${editingTemplateId === template._id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="tpl-main tpl-main-button"
                    onClick={() => onLoadTemplate(template)}
                  >
                    <span className="tpl-icon">📋</span>
                    <div className="tpl-info">
                      <span className="tpl-name">{template.templateName || template.name}</span>
                      <span className="tpl-meta">
                        {template.items?.length || 0} предмет.
                        {template.timeLimit > 0 && ` · ⏱ ${template.timeLimit} хв`}
                        {template.targetCity && <span style={{ marginLeft: '8px', color: '#38bdf8' }}>📍 {template.targetCity}</span>}
                      </span>
                    </div>
                  </button>

                  <div className="tpl-actions" onClick={(event) => event.stopPropagation()}>
                    {copyStatus === template._id ? (
                      <span className="copied-label">✓</span>
                    ) : (
                      <button type="button" className="tpl-btn" title="Скопіювати посилання" onClick={() => onCopyLink(template._id)}>📋</button>
                    )}
                    <button type="button" className="tpl-btn" title="Telegram" onClick={() => onShareTelegram(template._id)}>TG</button>
                    <button type="button" className="tpl-btn" title="Експорт" onClick={() => onExportTemplate(template)}>💾</button>
                    <button type="button" className="tpl-btn" title="Редагувати" onClick={() => onEditTemplate(template)}>✎</button>
                    <button type="button" className="tpl-btn tpl-btn-delete" title="Видалити" onClick={() => onDeleteTemplate(template._id)}>x</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default TemplatesPanel;
