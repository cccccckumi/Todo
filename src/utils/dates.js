export function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDueDate(value) {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (value === getLocalDateString(today)) return '今天';
  if (value === getLocalDateString(tomorrow)) return '明天';
  if (year !== today.getFullYear()) return `${year}年${month}月${day}日`;
  return `${month}月${day}日`;
}

export function getTaskDateGroup(task, today = getLocalDateString(new Date())) {
  if (!task.dueDate) return 'unscheduled';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return 'upcoming';
}
