// A simple bottom sheet (pop-up panel) shared by SOS and Garage backup conflicts.

function openSheet(html) {
  document.getElementById('sheet').innerHTML = html;
  document.getElementById('sheet-backdrop').hidden = false;
}

function closeSheet() {
  const backdrop = document.getElementById('sheet-backdrop');
  if (!backdrop) return;
  backdrop.hidden = true;
  document.getElementById('sheet').innerHTML = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
