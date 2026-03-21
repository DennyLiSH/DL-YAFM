import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock configService
vi.mock("@/services/configService", () => ({
  configService: {
    migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
  },
}));

import { detectLegacyData, isMigrated, executeMigration } from "./migration";

describe("migration utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("detectLegacyData", () => {
    it("should return null when already migrated", () => {
      localStorage.setItem("test-fm-migrated", "true");
      expect(detectLegacyData()).toBeNull();
    });

    it("should return null when no legacy data exists", () => {
      expect(detectLegacyData()).toBeNull();
    });

    it("should detect and transform settings data", () => {
      localStorage.setItem("test-fm-settings", JSON.stringify({
        state: {
          theme: "dark",
          language: "zh-CN",
          showHiddenFiles: true,
        },
      }));

      const result = detectLegacyData();
      expect(result).not.toBeNull();
      expect(result?.settings).toBeDefined();

      const settings = JSON.parse(result!.settings!);
      expect(settings.theme).toBe("dark");
      expect(settings.language).toBe("zh-CN");
      expect(settings.show_hidden_files).toBe(true);
    });

    it("should detect bookmarks data", () => {
      localStorage.setItem("test-fm-bookmarks", JSON.stringify({
        bookmarks: [
          { id: "1", name: "Test", path: "/test", createdAt: 1234567890 },
        ],
      }));

      const result = detectLegacyData();
      expect(result).not.toBeNull();
      expect(result?.bookmarks).toBeDefined();

      const bookmarks = JSON.parse(result!.bookmarks!);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].created_at).toBe(1234567890);
    });

    it("should detect chat messages data", () => {
      localStorage.setItem("test-fm-chat", JSON.stringify({
        messages: [
          { id: "1", role: "user", content: "hello", timestamp: 1234567890 },
        ],
      }));

      const result = detectLegacyData();
      expect(result).not.toBeNull();
      expect(result?.chat).toBeDefined();
    });
  });

  describe("isMigrated", () => {
    it("should return false when not migrated", () => {
      expect(isMigrated()).toBe(false);
    });

    it("should return true when migrated flag exists", () => {
      localStorage.setItem("test-fm-migrated", "true");
      expect(isMigrated()).toBe(true);
    });
  });

  describe("executeMigration", () => {
    it("should mark migration as complete after success", async () => {
      const data = {
        settings: JSON.stringify({ theme: "dark" }),
      };

      const result = await executeMigration(data);
      expect(result).toBe(true);
      expect(isMigrated()).toBe(true);
    });
  });
});
