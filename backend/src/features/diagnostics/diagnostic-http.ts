import { readJsonBody } from "@/lib/api/json-body";
import { normalizeDiagnosticInput, type DiagnosticDraftInput } from "./diagnostic-validation";

export async function diagnosticDraftInput(request: Request): Promise<DiagnosticDraftInput> {
  return normalizeDiagnosticInput(await readJsonBody(request));
}
