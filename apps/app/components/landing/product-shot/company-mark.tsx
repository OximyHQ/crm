import Logo from "@crm/ui/components/logo";
import { cn } from "@crm/ui/lib/utils";
import Image from "next/image";
import type { MockCompany } from "./companies";

export function CompanyMark({
	company,
	size,
}: {
	company: Pick<MockCompany, "name" | "logo">;
	size: number;
	glyph: number;
}) {
	if (!company.logo) {
		return (
			<span className="flex shrink-0 items-center justify-center">
				<Logo className="shrink-0" style={{ width: size, height: size }} />
			</span>
		);
	}

	return (
		<span
			className="flex shrink-0 items-center justify-center overflow-clip"
			style={{ width: size, height: size }}
		>
			<Image
				src={company.logo.src}
				alt=""
				width={size}
				height={size}
				className={cn(
					"size-full object-contain",
					company.logo.invert && "invert",
				)}
			/>
		</span>
	);
}
