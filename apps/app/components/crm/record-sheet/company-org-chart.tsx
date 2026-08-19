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
	fullName: string;
	title: string;
	tier: number;
	orgFunction: string;
	seniorityRank: number;
	status: string;
	linkedinUrl: string | null;
	contactId: string | null;
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

function buildFlow(
	companyName: string,
	people: ChartPerson[],
	onOpen: (id: string) => void,
): { nodes: ChartFlowNode[]; edges: Edge[] } {
	const sorted = [...people].sort(
		(a, b) =>
			a.seniorityRank - b.seniorityRank ||
			a.tier - b.tier ||
			a.fullName.localeCompare(b.fullName),
	);

	const lanes = new Map<string, ChartPerson[]>();
	for (const person of sorted) {
		const lane = LANES.includes(person.orgFunction)
			? person.orgFunction
			: "Other";
		const bucket = lanes.get(lane);
		if (bucket) bucket.push(person);
		else lanes.set(lane, [person]);
	}

	const root = lanes.get("Executive")?.[0] ?? null;
	if (root) {
		const executives = (lanes.get("Executive") ?? []).slice(1);
		if (executives.length > 0) lanes.set("Executive", executives);
		else lanes.delete("Executive");
	}

	const orderedLanes = LANES.filter((lane) => lanes.has(lane));
	const laneCount = Math.max(orderedLanes.length, 1);
	const centerX = ((laneCount - 1) * CHART.laneWidth) / 2;

	const rootId = root ? root.id : "company-root";
	const rootNode: ChartFlowNode = root
		? {
				id: rootId,
				type: "person",
				position: { x: centerX, y: CHART.rootY },
				data: { person: root, onOpen },
			}
		: {
				id: rootId,
				type: "company",
				position: { x: centerX, y: CHART.rootY },
				data: { label: companyName },
			};

	const nodes: ChartFlowNode[] = [rootNode];
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
			const parent = memberIndex === 0 ? rootId : (members[0]?.id ?? rootId);
			edges.push({
				id: `${parent}-${person.id}`,
				source: parent,
				target: person.id,
				type: "smoothstep",
			});
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

	const built = useMemo(
		() =>
			buildFlow(companyName, people, (id) => {
				openRef.current(id);
			}),
		[companyName, people],
	);

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
		<div className="relative h-[70vh] min-h-96 w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				nodeTypes={NODE_TYPES}
				fitView
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
				Inferred from titles, not actual reporting lines
			</div>
		</div>
	);
}
