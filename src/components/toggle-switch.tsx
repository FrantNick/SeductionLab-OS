/**
 * Server-action-backed on/off switch — a styled submit button, so it
 * works without client JS. Bind the target state into the action:
 *
 *   <ToggleSwitch action={toggleProxy.bind(null, id, !proxy.enabled)}
 *                 checked={proxy.enabled} label="Toggle proxy" />
 */
export function ToggleSwitch({
  action,
  checked,
  label,
}: {
  action: () => Promise<void>;
  checked: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`relative h-6 w-11 rounded-full border-brutal border-line transition-colors ${
          checked ? "bg-pos" : "bg-ink-800"
        }`}
      >
        <span
          className={`absolute top-[1.5px] h-4 w-4 rounded-full border-brutal border-line bg-white transition-all ${
            checked ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </form>
  );
}
