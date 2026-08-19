"use client";

import "@xyflow/react/dist/style.css";

import { Badge } from "@crm/ui/components/badge";
import {
	Background,
	type Edge,
	Handle,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";

export type ChartPerson = {
	id: string;
	personId: string;
	fullName: string;
	title: string;
	tier: number;
	orgFunction: string;
	seniorityRank: number;
	status: string;
	linkedinUrl: string | null;
	contactId: string | null;
	reportsToPersonId: string | null;
};

const LANES = [
	"Executive",
	"Engineering",
	"IT",
	"Security",
	"Data & AI",
	"Other",
];

const CHART = {
	laneWidth: 268,
	leaderY: 170,
	rowHeight: 110,
	rootY: 0,
	levelGap: 150,
	stackGap: 96,
	stackThreshold: 3,
} as const;

type PersonDatum = {
	person: ChartPerson;
	onOpen: (id: string) => void;
};

type CompanyDatum = {
	label: string;
};

type PersonFlowNode = Node<PersonDatum, "person">;
type CompanyFlowNode = Node<CompanyDatum, "company">;
type ChartFlowNode = PersonFlowNode | CompanyFlowNode;

function PersonNode({ data }: NodeProps<PersonFlowNode>) {
	const { person, onOpen } = data;
	return (
		<button
			type="button"
			className="w-60 cursor-pointer rounded-md border bg-background px-3 py-2 text-left shadow-xs"
			onClick={() => onOpen(person.id)}
		>
			<Handle type="target" position={Position.Top} isConnectable={false} />
			<span className="block truncate text-sm font-medium">
				{person.fullName}
			</span>
			<span className="block truncate text-xs text-muted-foreground">
				{person.title}
			</span>
			{person.status === "ADDED" ? (
				<span className="mt-1.5 block">
					<Badge variant="outline">In CRM</Badge>
				</span>
			) : null}
			<Handle type="source" position={Position.Bottom} isConnectable={false} />
		</button>
	);
}

function CompanyNode({ data }: NodeProps<CompanyFlowNode>) {
	return (
		<div className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs">
			{data.label}
			<Handle type="source" position={Position.Bottom} isConnectable={false} />
		</div>
	);
}

const NODE_TYPES = { person: PersonNode, company: CompanyNode };

function byRank(a: ChartPerson, b: ChartPerson): number {
	return (
		a.seniorityRank - b.seniorityRank ||
		a.tier - b.tier ||
		a.fullName.localeCompare(b.fullName)
	);
}

function buildTreeFlow(
	companyName: string,
	people: ChartPerson[],
	onOpen: (id: string) => void,
): { nodes: ChartFlowNode[]; edges: Edge[] } {
	const byPersonId = new Map(people.map((person) => [person.personId, person]));
	const children = new Map<string, ChartPerson[]>();
	const roots: ChartPerson[] = [];

	for (const person of [...people].sort(byRank)) {
		const parent = person.reportsToPersonId
			? byPersonId.get(person.reportsToPersonId)
			: undefined;
		if (parent && parent.personId !== person.personId) {
			const bucket = children.get(parent.personId);
			if (bucket) bucket.push(person);
			else children.set(parent.personId, [person]);
		} else {
			roots.push(person);
		}
	}

	const isLeaf = (person: ChartPerson): boolean =>
		(children.get(person.personId) ?? []).length === 0;

	const split = (person: ChartPerson) => {
		const kids = children.get(person.personId) ?? [];
		const leaves = kids.filter(isLeaf);
		const stacked =
			leaves.length >= CHART.stackThreshold ? leaves : ([] as ChartPerson[]);
		const spread = kids.filter((kid) => !stacked.includes(kid));
		return { stacked, spread };
	};

	const widths = new Map<string, number>();
	const measure = (person: ChartPerson): number => {
		const { stacked, spread } = split(person);
		const spreadWidth = spread.reduce((total, kid) => total + measure(kid), 0);
		const width = Math.max(1, spreadWidth + (stacked.length > 0 ? 1 : 0));
		widths.set(person.personId, width);
		return width;
	};
	for (const root of roots) measure(root);

	const nodes: ChartFlowNode[] = [];
	const edges: Edge[] = [];
	const singleRoot = roots.length === 1;

	const place = (person: ChartPerson, unitX: number, y: number): void => {
		const width = widths.get(person.personId) ?? 1;
		nodes.push({
			id: person.id,
			type: "person",
			position: {
				x: (unitX + width / 2 - 0.5) * CHART.laneWidth,
				y,
			},
			data: { person, onOpen },
		});

		const { stacked, spread } = split(person);
		let cursor = unitX;
		for (const kid of spread) {
			edges.push({
				id: `${person.id}-${kid.id}`,
				source: person.id,
				target: kid.id,
				type: "smoothstep",
			});
			place(kid, cursor, y + CHART.levelGap);
			cursor += widths.get(kid.personId) ?? 1;
		}
		stacked.forEach((kid, index) => {
			edges.push({
				id: `${person.id}-${kid.id}`,
				source: person.id,
				target: kid.id,
				type: "smoothstep",
			});
			nodes.push({
				id: kid.id,
				type: "person",
				position: {
					x: (cursor + 0.5 - 0.5) * CHART.laneWidth + 24,
					y: y + CHART.levelGap + index * CHART.stackGap,
				},
				data: { person: kid, onOpen },
			});
		});
	};

	if (singleRoot && roots[0]) {
		place(roots[0], 0, 0);
	} else {
		const totalWidth = roots.reduce(
			(total, root) => total + (widths.get(root.personId) ?? 1),
			0,
		);
		nodes.push({
			id: "company-root",
			type: "company",
			position: {
				x: ((Math.max(totalWidth, 1) - 1) / 2) * CHART.laneWidth,
				y: CHART.rootY,
			},
			data: { label: companyName },
		});
		let cursor = 0;
		for (const root of roots) {
			edges.push({
				id: `company-root-${root.id}`,
				source: "company-root",
				target: root.id,
				type: "smoothstep",
			});
			place(root, cursor, CHART.levelGap);
			cursor += widths.get(root.personId) ?? 1;
		}
	}

	return { nodes, edges };
}

function buildLaneFlow(
	companyName: string,
	people: ChartPerson[],
	onOpen: (id: string) => void,
): { nodes: ChartFlowNode[]; edges: Edge[] } {
	const sorted = [...people].sort(byRank);

	const lanes = new Map<string, ChartPerson[]>();
	for (const person of sorted) {
		const lane = LANES.includes(person.orgFunction)
			? person.orgFunction
			: "Other";
		const bucket = lanes.get(lane);
		if (bucket) bucket.push(person);
		else lanes.set(lane, [person]);
	}

	const orderedLanes = LANES.filter((lane) => lanes.has(lane));
	const laneCount = Math.max(orderedLanes.length, 1);
	const centerX = ((laneCount - 1) * CHART.laneWidth) / 2;

	const nodes: ChartFlowNode[] = [
		{
			id: "company-root",
			type: "company",
			position: { x: centerX, y: CHART.rootY },
			data: { label: companyName },
		},
	];
	const edges: Edge[] = [];

	orderedLanes.forEach((lane, laneIndex) => {
		const members = lanes.get(lane) ?? [];
		members.forEach((person, memberIndex) => {
			nodes.push({
				id: person.id,
				type: "person",
				position: {
					x: laneIndex * CHART.laneWidth,
					y: CHART.leaderY + memberIndex * CHART.rowHeight,
				},
				data: { person, onOpen },
			});
			if (memberIndex === 0) {
				edges.push({
					id: `company-root-${person.id}`,
					source: "company-root",
					target: person.id,
					type: "smoothstep",
				});
			}
		});
	});

	return { nodes, edges };
}

export function CompanyOrgChart({
	companyName,
	people,
	onOpen,
}: {
	companyName: string;
	people: ChartPerson[];
	onOpen: (id: string) => void;
}) {
	const openRef = useRef(onOpen);
	openRef.current = onOpen;

	const hasHierarchy = people.some(
		(person) => person.reportsToPersonId !== null,
	);

	const built = useMemo(() => {
		const open = (id: string) => {
			openRef.current(id);
		};
		return hasHierarchy
			? buildTreeFlow(companyName, people, open)
			: buildLaneFlow(companyName, people, open);
	}, [companyName, people, hasHierarchy]);

	const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

	useEffect(() => {
		setNodes(built.nodes);
		setEdges(built.edges);
	}, [built, setNodes, setEdges]);

	if (people.length === 0) {
		return (
			<div className="px-5 py-12 text-center text-sm text-muted-foreground">
				Nothing matches the current filters.
			</div>
		);
	}

	return (
		<div className="relative h-full min-h-96 w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				nodeTypes={NODE_TYPES}
				fitView
				fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
				minZoom={0.15}
				maxZoom={1.5}
				nodesConnectable={false}
				deleteKeyCode={null}
				panOnScroll
				zoomOnScroll={false}
				zoomOnPinch
			>
				<Background gap={24} />
			</ReactFlow>
			<div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
				{hasHierarchy
					? "Reporting lines estimated by AI from titles"
					: "Grouped by function, not actual reporting lines"}
			</div>
		</div>
	);
}
