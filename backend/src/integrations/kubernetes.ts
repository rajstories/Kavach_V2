import { logger } from "../config/logger";
import { prisma } from "../db/client";

type IsolateNodeInput = {
  allowSOCAccess: boolean;
  blockAllEgress: boolean;
};

type ScaleInput = {
  replicas: number;
  reason: string;
};

export async function k8sIsolateNode(node: string, input: IsolateNodeInput): Promise<void> {
  logger.info("K8s: Isolating node (stub)", {
    node,
    allowSOCAccess: input.allowSOCAccess,
    blockAllEgress: input.blockAllEgress,
  });

  await prisma.infraOperation.create({
    data: {
      operation: "k8s_isolate_node",
      target: node,
      detailsJson: {
        allowSOCAccess: input.allowSOCAccess,
        blockAllEgress: input.blockAllEgress,
        isolated: true,
      },
    },
  });
}

export async function k8sScale(service: string, input: ScaleInput): Promise<void> {
  logger.info("K8s: Scaling service (stub)", {
    service,
    replicas: input.replicas,
    reason: input.reason,
  });

  await prisma.infraOperation.create({
    data: {
      operation: "k8s_scale",
      target: service,
      detailsJson: {
        replicas: input.replicas,
        reason: input.reason,
      },
    },
  });
}

export async function netstatKillConnection(node: string, ip: string): Promise<void> {
  logger.info("K8s: Killing connection (stub)", {
    node,
    ip,
  });

  await prisma.infraOperation.create({
    data: {
      operation: "netstat_kill_connection",
      target: node,
      detailsJson: {
        ip,
      },
    },
  });
}
