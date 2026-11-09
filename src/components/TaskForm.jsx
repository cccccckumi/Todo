import { useState } from 'react';

const fixedCategories = ['学习', '生活', '社团', '其他'];
const customCategoryOption = '__create_custom_category__';
const priorities = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

export default function TaskForm({ task, defaults, categories = [], onSave, onCancel }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults?.dueDate ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'medium');
  const [category, setCategory] = useState(task?.category ?? defaults?.category ?? '其他');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const cleanedTitle = title.trim();

    if (!cleanedTitle) {
      setError('请填写任务名称。');
      return;
    }

    const cleanedCategory = category === customCategoryOption ? newCategory.trim() : category;
    if (!cleanedCategory) {
      setCategoryError('请输入分类名称。');
      return;
    }
    if (cleanedCategory.length > 24) {
      setCategoryError('分类名称不能超过 24 个字。');
      return;
    }

    setSaving(true);
    try { await onSave({
      ...(task ?? {}),
      title: cleanedTitle,
      dueDate,
      priority,
      category: cleanedCategory,
    }); } finally { setSaving(false); }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form-heading">
        <div>
          <h3>{task ? '编辑任务' : '新建任务'}</h3>
        </div>
        <button className="icon-button form-close" type="button" onClick={onCancel} aria-label="取消并关闭表单">
          <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="task-fields">
        <div className="field field-wide">
          <label htmlFor="task-title">任务名称</label>
          <input
            autoFocus
            id="task-title"
            type="text"
            value={title}
            maxLength={120}
            placeholder="例如：完成线性代数作业"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'task-title-error' : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError('');
            }}
          />
          {error && <span className="field-error" id="task-title-error">{error}</span>}
        </div>

        <div className="field">
          <label htmlFor="task-date">截止日期</label>
          <input id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="task-priority">优先级</label>
          <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="field field-wide">
          <label htmlFor="task-category">分类</label>
          <select
            id="task-category"
            value={category}
            aria-invalid={Boolean(categoryError)}
            aria-describedby={categoryError ? 'task-category-error' : undefined}
            onChange={(event) => {
              setCategory(event.target.value);
              setCategoryError('');
            }}
          >
            {[...new Set([...fixedCategories, ...categories])].map((item) => <option key={item} value={item}>{item}</option>)}
            <option value={customCategoryOption}>＋ 新建分类</option>
          </select>
          {category === customCategoryOption && (
            <input
              id="new-task-category"
              type="text"
              maxLength={24}
              placeholder="输入分类名称"
              value={newCategory}
              aria-label="新分类名称"
              aria-invalid={Boolean(categoryError)}
              aria-describedby={categoryError ? 'task-category-error' : undefined}
              onChange={(event) => {
                setNewCategory(event.target.value);
                setCategoryError('');
              }}
            />
          )}
          {categoryError && <span className="field-error" id="task-category-error">{categoryError}</span>}
        </div>
      </div>

      <div className="task-form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
        <button className="save-button" type="submit" disabled={saving}>{saving ? '保存中…' : task ? '保存修改' : '添加任务'}</button>
      </div>
    </form>
  );
}
