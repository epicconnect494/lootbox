import { route, ok } from "@/lib/api";
import { signingKeyId, signingPublicKeyPem } from "@/lib/fairness/node";
import vectors from "../../../../../../docs/fairness-test-vectors.json";

export const GET = route({ auth: "none" }, async () => ok({ keyId: signingKeyId(), publicKeyPem: signingPublicKeyPem(), algorithm: "Ed25519 over canonical JSON (sorted keys)", testVectors: vectors }));
