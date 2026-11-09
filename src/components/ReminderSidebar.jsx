import AnimatedCount from './AnimatedCount.jsx';

const categories = [
  { name: '学习', color: 'category-study' },
  { name: '生活', color: 'category-life' },
  { name: '社团', color: 'category-club' },
  { name: '其他', color: 'category-other' },
];

const smartLists = [
  { type: 'incomplete', label: '未完成', icon: 'incomplete' },
  { type: 'completed', label: '已完成', icon: 'completed' },
  { type: 'deleted', label: '已删除', icon: 'deleted' },
];

function countForList(tasks, type, category) {
  const activeTasks = tasks.filter((task) => !task.deleted);
  const pendingTasks = activeTasks.filter((task) => !task.completed);
  if (type === 'incomplete') return pendingTasks.length;
  if (type === 'completed') return activeTasks.filter((task) => task.completed).length;
  if (type === 'deleted') return tasks.filter((task) => task.deleted).length;
  if (type === 'category') return pendingTasks.filter((task) => task.category === category).length;
  return pendingTasks.length;
}

function SmartIcon({ type }) {
  const paths = {
    incomplete: <><circle cx="4.5" cy="5" r="1.3" /><path d="M8 5h8M3.2 10h2.6m2.2 0h8M3.2 15h2.6m2.2 0h8" /></>,
    completed: <><circle cx="10" cy="10" r="6.5" /><path d="m6.8 10 2.1 2.1 4.3-4.4" /></>,
    deleted: <><path d="M4 6h12m-10 0 .7 10h6.6L14 6M8 6V4h4v2" /><path d="M8.5 9v4m3-4v4" /></>,
  };

  return <svg className={`smart-icon smart-icon-${type}`} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}

export default function ReminderSidebar({ tasks, activeList, onSelect }) {
  const customCategories = [...new Set(tasks.map((task) => task.category))]
    .filter((name) => !categories.some((category) => category.name === name))
    .map((name) => ({ name, color: 'category-custom' }));
  const categoryItems = [...categories, ...customCategories];

  return (
    <aside className="reminder-sidebar" aria-label="清单导航">
      <nav aria-label="智能清单">
        <p className="sidebar-heading">智能清单</p>
        <ul className="sidebar-list">
          {smartLists.map((list) => (
            <li key={list.type}>
              <button
                className={`sidebar-item${activeList.type === list.type ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={activeList.type === list.type}
                onClick={() => onSelect({ type: list.type, category: '' })}
              >
                <SmartIcon type={list.icon} />
                <span className="sidebar-item-label">{list.label}</span>
                <AnimatedCount className="sidebar-count" value={countForList(tasks, list.type)} />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="category-navigation" aria-label="分类清单">
        <p className="sidebar-heading">我的分类</p>
        <ul className="sidebar-list">
          {categoryItems.map((category) => {
            const selected = activeList.type === 'category' && activeList.category === category.name;
            return (
              <li key={category.name}>
                <button
                  className={`sidebar-item${selected ? ' is-selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect({ type: 'category', category: category.name })}
                >
                  <span className={`category-dot ${category.color}`} aria-hidden="true" />
                  <span className="sidebar-item-label" title={category.name}>{category.name}</span>
                  <AnimatedCount className="sidebar-count" value={countForList(tasks, 'category', category.name)} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
