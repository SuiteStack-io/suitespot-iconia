import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COUNTRY_CODES = [
  { code: "EG", dial: "+20", flag: "🇪🇬" },
  { code: "AE", dial: "+971", flag: "🇦🇪" },
  { code: "SA", dial: "+966", flag: "🇸🇦" },
  { code: "US", dial: "+1", flag: "🇺🇸" },
  { code: "GB", dial: "+44", flag: "🇬🇧" },
  { code: "FR", dial: "+33", flag: "🇫🇷" },
  { code: "DE", dial: "+49", flag: "🇩🇪" },
  { code: "IT", dial: "+39", flag: "🇮🇹" },
  { code: "ES", dial: "+34", flag: "🇪🇸" },
  { code: "JO", dial: "+962", flag: "🇯🇴" },
  { code: "LB", dial: "+961", flag: "🇱🇧" },
  { code: "MA", dial: "+212", flag: "🇲🇦" },
];

function parsePhone(value: string): { dialCode: string; localNumber: string } {
  if (!value) return { dialCode: "+20", localNumber: "" };
  // Try matching longest dial codes first
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { dialCode: c.dial, localNumber: value.slice(c.dial.length) };
    }
  }
  // If starts with + but no match, keep as-is
  if (value.startsWith("+")) {
    return { dialCode: "+20", localNumber: value };
  }
  return { dialCode: "+20", localNumber: value };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = "Phone number", className }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = React.useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = React.useState(parsed.localNumber);

  // Sync from external value changes
  React.useEffect(() => {
    const p = parsePhone(value);
    setDialCode(p.dialCode);
    setLocalNumber(p.localNumber);
  }, [value]);

  const handleDialChange = (newDial: string) => {
    setDialCode(newDial);
    onChange(localNumber ? newDial + localNumber : "");
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/[^0-9]/g, "");
    setLocalNumber(num);
    onChange(num ? dialCode + num : "");
  };

  return (
    <div className={cn("flex", className)}>
      <Select value={dialCode} onValueChange={handleDialChange}>
        <SelectTrigger className="w-[100px] rounded-r-none border-r-0 shrink-0 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map(c => (
            <SelectItem key={c.code} value={c.dial}>
              {c.flag} {c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="tel"
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        className={cn(
          "flex h-10 w-full rounded-md rounded-l-none border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        )}
      />
    </div>
  );
}

