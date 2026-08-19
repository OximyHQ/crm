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
	laneWidth: 210,
	leaderY: 170,
	rowHeight: 110,
	rootY: 0,
	levelGap: 140,
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
			className="w-48 cursor-pointer rounded-md border bg-background px-2.5 py-1.5 text-left shadow-xs"
			onClick={() => onOpen(person.id)}
		>
			<Handle type="target" position={Position.Top} isConnectable={false} />
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="truncate text-xs font-medium">{person.fullName}</span>
				{person.status === "ADDED" ? (
					<Badge variant="outline">In CRM</Badge>
				) : null}
			</span>
			<span className="block truncate text-[11px] text-muted-foreground">
				{person.title}
			</span>
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

	const nodes: ChartFlowNode[] = [];
	const edges: Edge[] = [];
	const singleRoot = roots.length === 1;
	const levelOffset = singleRoot ? 0 : 1;

	const levels: ChartPerson[][] = [];
	const walk = (person: ChartPerson, depth: number): void => {
		const level = levels[depth];
		if (level) level.push(person);
		else levels[depth] = [person];
		for (const kid of children.get(person.personId) ?? []) {
			edges.push({
				id: `${person.id}-${kid.id}`,
				source: person.id,
				target: kid.id,
				type: "smoothstep",
			});
			walk(kid, depth + 1);
		}
	};
	for (const root of roots) walk(root, 0);

	if (!singleRoot) {
		nodes.push({
			id: "company-root",
			type: "company",
			position: { x: -60, y: CHART.rootY },
			data: { label: companyName },
		});
		for (const root of roots) {
			edges.push({
				id: `company-root-${root.id}`,
				source: "company-root",
				target: root.id,
				type: "smoothstep",
			});
		}
	}

	levels.forEach((level, depth) => {
		const rowWidth = (level.length - 1) * CHART.laneWidth;
		level.forEach((person, index) => {
			nodes.push({
				id: person.id,
				type: "person",
				position: {
					x: index * CHART.laneWidth - rowWidth / 2,
					y: (depth + levelOffset) * CHART.levelGap,
				},
				data: { person, onOpen },
			});
		});
	});

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
