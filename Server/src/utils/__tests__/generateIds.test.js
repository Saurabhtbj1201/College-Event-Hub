const generatePassId = require("../generatePassId");
const generateGroupCode = require("../generateGroupCode");
const generateFoodOrderNumber = require("../generateFoodOrderNumber");

describe("identifier generators", () => {
  it("creates pass ids with expected prefix", () => {
    const passId = generatePassId();
    expect(passId).toMatch(/^PASS-[A-Z0-9]+-[A-Z0-9]{6}$/);
  });

  it("creates group code using safe alphabet", () => {
    const code = generateGroupCode();
    expect(code).toMatch(/^GRP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("creates food order numbers with fixed prefix and six digits", () => {
    const orderNumber = generateFoodOrderNumber();
    expect(orderNumber).toMatch(/^FOOD-\d{6}$/);
  });

  it("generates mostly unique values across a small sample", () => {
    const values = new Set(Array.from({ length: 200 }, () => generatePassId()));
    expect(values.size).toBeGreaterThan(190);
  });
});
