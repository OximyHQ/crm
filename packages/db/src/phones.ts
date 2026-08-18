export function normalizePhone(
	value: string | null | undefined,
): string | null {
	if (!value) return null;
	const digits = value.replace(/\D/g, "");
	if (value.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	return null;
}
