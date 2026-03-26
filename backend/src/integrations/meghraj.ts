import { logger } from "../config/logger";
import { prisma } from "../db/client";

// In production: real NIC MeghRaj REST API.
// For demo: realistic stubs with proper logging.
const MEGHRAJ_BASE = process.env.MEGHRAJ_API_BASE || "https://meghraj.nic.in/api/v1";

type CreateDiskSnapshotInput = {
  node: string;
  label: string;
  note: string;
};

export async function createDiskSnapshot(
  input: CreateDiskSnapshotInput,
): Promise<{
  snapshot_id: string;
  node: string;
  service: string;
  label: string;
  note: string;
  created_at: string;
  status: "ready";
}> {
  logger.info(`MeghRaj: Creating snapshot for ${input.node}`, {
    base: MEGHRAJ_BASE,
    node: input.node,
    label: input.label,
    note: input.note,
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

  const snapshot_id = `snap-${Date.now()}`;
  const created_at = new Date().toISOString();

  await prisma.diskSnapshot.create({
    data: {
      snapshotId: snapshot_id,
      node: input.node,
      service: input.label,
      label: input.label,
      note: input.note,
      provider: "meghraj",
      status: "ready",
      createdAt: new Date(created_at),
    },
  });

  return {
    snapshot_id,
    node: input.node,
    service: input.label,
    label: input.label,
    note: input.note,
    created_at,
    status: "ready",
  };
}

export async function getSnapshot(snapshotId: string): Promise<{
  snapshot_id: string;
  node: string;
  service: string;
  label: string;
  note: string;
  status: string;
  created_at: string;
} | null> {
  const snapshot = await prisma.diskSnapshot.findUnique({
    where: { snapshotId },
  });

  if (!snapshot) {
    return null;
  }

  return {
    snapshot_id: snapshot.snapshotId,
    node: snapshot.node,
    service: snapshot.service,
    label: snapshot.label,
    note: snapshot.note,
    status: snapshot.status,
    created_at: snapshot.createdAt.toISOString(),
  };
}

export async function listSnapshots(service: string): Promise<
  Array<{
    snapshot_id: string;
    node: string;
    service: string;
    label: string;
    note: string;
    status: string;
    created_at: string;
  }>
> {
  const snapshots = await prisma.diskSnapshot.findMany({
    where: { service },
    orderBy: { createdAt: "desc" },
  });

  return snapshots.map((snapshot) => ({
    snapshot_id: snapshot.snapshotId,
    node: snapshot.node,
    service: snapshot.service,
    label: snapshot.label,
    note: snapshot.note,
    status: snapshot.status,
    created_at: snapshot.createdAt.toISOString(),
  }));
}
