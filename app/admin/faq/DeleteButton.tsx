"use client";

export function DeleteButton() {
  return (
    <button
      type="submit"
      className="text-sm text-pink underline"
      onClick={(e) => {
        if (!confirm("Delete this question? This can't be undone.")) e.preventDefault();
      }}
    >
      Delete
    </button>
  );
}
