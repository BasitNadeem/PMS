/**
 * The asterisk marking a field the form will not submit without.
 *
 * Its own component so "required" looks identical everywhere — the group
 * booking wizard had a hand-rolled coral asterisk while the company modals used
 * a plain grey "*" in the label text, which read as decoration rather than a
 * rule.
 *
 * Only use this where the field is genuinely required. Marking optional fields
 * teaches people to ignore the asterisk.
 */
export function RequiredMark() {
  return (
    <span aria-hidden className="text-coral text-[15px] font-bold leading-none">
      {" "}*
    </span>
  );
}
