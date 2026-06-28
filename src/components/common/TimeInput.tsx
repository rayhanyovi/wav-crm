import { useEffect, useState, type FocusEvent, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { formatTimeForInputDisplay, parseTimeInput } from "@/lib/time";

interface TimeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function TimeInput({
  value,
  onValueChange,
  onBlur,
  onFocus,
  placeholder = "4:30 PM",
  ...props
}: TimeInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatTimeForInputDisplay(value));

  useEffect(() => {
    if (!focused) setDraft(formatTimeForInputDisplay(value));
  }, [focused, value]);

  const commitDraft = (raw: string) => {
    const parsed = parseTimeInput(raw);
    if (parsed !== null) onValueChange(parsed);
    return parsed;
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    const parsed = commitDraft(draft);
    setDraft(parsed === null ? formatTimeForInputDisplay(value) : formatTimeForInputDisplay(parsed));
    onBlur?.(event);
  };

  return (
    <Input
      {...props}
      type="text"
      autoComplete="off"
      placeholder={placeholder}
      value={draft}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        commitDraft(next);
      }}
    />
  );
}
