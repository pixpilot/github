import { CodeQLInstaller } from "../../src/codeql/installer";

describe("codeQLInstaller", () => {
  describe("getPlatformIdentifier", () => {
    it("should return correct platform identifiers", () => {
      // Test the platform detection logic indirectly by checking that it doesn't throw
      expect(() => {
        // Access the private method via type assertion for testing
        const installer = CodeQLInstaller as any;
        const platform = installer.getPlatformIdentifier();
        expect(typeof platform).toBe("string");
        expect(["linux64", "osx64", "win64"]).toContain(platform);
      }).not.toThrow();
    });
  });

  describe("findBundleAsset", () => {
    it("should prefer .tar.gz over .tar.zst", () => {
      const installer = CodeQLInstaller as any;
      const mockAssets = [
        {
          name: "codeql-bundle-linux64.tar.zst",
          size: 1000,
          browser_download_url: "test-zst-url",
        },
        {
          name: "codeql-bundle-linux64.tar.gz",
          size: 2000,
          browser_download_url: "test-gz-url",
        },
      ];

      const result = installer.findBundleAsset(mockAssets, "linux64");
      expect(result).toBeDefined();
      expect(result.name).toBe("codeql-bundle-linux64.tar.gz");
    });

    it("should return .tar.zst if .tar.gz is not available", () => {
      const installer = CodeQLInstaller as any;
      const mockAssets = [
        {
          name: "codeql-bundle-linux64.tar.zst",
          size: 1000,
          browser_download_url: "test-zst-url",
        },
      ];

      const result = installer.findBundleAsset(mockAssets, "linux64");
      expect(result).toBeDefined();
      expect(result.name).toBe("codeql-bundle-linux64.tar.zst");
    });

    it("should return null if no matching bundle is found", () => {
      const installer = CodeQLInstaller as any;
      const mockAssets = [
        {
          name: "some-other-file.tar.gz",
          size: 1000,
          browser_download_url: "test-url",
        },
      ];

      const result = installer.findBundleAsset(mockAssets, "linux64");
      expect(result).toBeNull();
    });
  });
});
