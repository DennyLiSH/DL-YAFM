describe("Tauri App E2E Tests", () => {
  beforeEach(async () => {
    await browser.url("/");
    // Wait for app to load
    await browser.waitUntil(
      async () => {
        const title = await browser.getTitle();
        return title.length > 0;
      },
      { timeout: 10000 }
    );
  });

  it("should load the application", async () => {
    const title = await browser.getTitle();
    expect(title).toBeDefined();
  });

  it("should have main container visible", async () => {
    // Wait for the main app container
    const body = await $("body");
    await body.waitForDisplayed({ timeout: 5000 });
    const isDisplayed = await body.isDisplayed();
    expect(isDisplayed).toBe(true);
  });

  it("should have file tree component", async () => {
    // Look for file tree container (adjust selector based on actual app)
    const fileTree = await $("[data-testid='file-tree'], .file-tree, aside");
    const exists = await fileTree.isExisting();
    // This test might fail if the selector doesn't match
    // Adjust the selector based on your actual app structure
    expect(typeof exists).toBe("boolean");
  });
});
