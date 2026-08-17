import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

describe("abertura de histórico a partir dos Alertas de Variação", () => {
  it("usa o mesmo modal controlado por estado para alertas, itens ativos e itens entregues", () => {
    expect(homeSource).toContain('<Dialog open={selectedItemId !== null}');
    expect(homeSource).toContain('onOpenChange={(open) => { if (!open) setSelectedItemId(null); }}');
    expect(homeSource).toContain('onClick={() => setSelectedItemId(alert.id)}');
    expect(homeSource).toContain('onClick={() => setSelectedItemId(row.id)}><History');
  });
});
