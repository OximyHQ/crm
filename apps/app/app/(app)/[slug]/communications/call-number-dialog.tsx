"use client";

import Phone from "@carbon/icons-react/es/Phone";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useId, useState } from "react";
import { quoWebDialerUrl } from "@/lib/quo-web-dialer";

export function CallNumberDialog() {
	const [open, setOpen] = useState(false);
	const [number, setNumber] = useState("");
	const inputId = useId();
	const dialable = number.replace(/[^+\d*#,;]/g, "");

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Icon icon={Phone} data-icon="inline-start" />
					Call a number
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Call any number</DialogTitle>
					<DialogDescription>
						Quo opens in your browser with this number ready. Unknown numbers
						enter review after the call.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={inputId}>Phone number</FieldLabel>
					<Input
						id={inputId}
						type="tel"
						value={number}
						onChange={(event) => setNumber(event.target.value)}
						placeholder="+1 415 555 0100"
						autoComplete="tel"
					/>
				</Field>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					{dialable.length >= 8 ? (
						<Button asChild>
							<a
								href={quoWebDialerUrl(dialable)}
								target="_blank"
								rel="noreferrer"
								onClick={() => setOpen(false)}
							>
								Open Quo web dialer
							</a>
						</Button>
					) : (
						<Button disabled>Open Quo web dialer</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
