export function DeleteConfirmation({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <div className="delete-confirm">
      <span>Are you sure?</span>
      <button type="button" role="menuitem" aria-label={label} className="confirm-delete" onClick={onConfirm}>Confirm delete</button>
    </div>
  )
}
