// Deliberately failing, to prove the CI gate goes red on a pull request.
// This file exists only on the throwaway `ci/deliberately-red` branch, which is
// deleted once the failing run is linked from ticket #5.
describe("the CI gate", () => {
  it("fails the run when a test fails", () => {
    expect(1).toBe(2);
  });
});
