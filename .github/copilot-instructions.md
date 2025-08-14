## **General Guidelines**

- **Package Manager**: Only use `pnpm` for installing or managing dependencies within this project's actual source code. However, for all `README.md` and other documentation files, always use `npm` commands (`npm install -D ...`) for user-facing examples.
- **File Naming**: When creating a new configuration, the file name in the repository must correspond to the entry point specified in the documentation (e.g., a config for `eslint-foo` would be located at `eslint-foo.js` and accessed via `@pixpilot/dev-config/eslint-foo`).

---

## **README.md Documentation Structure**

The `README.md` follows a modular, **step-by-step structure**. new configurations are presented as **"add-ons"** to a core setup.

When asked to add a new configuration, you must add it as a new subsection within the `#### Step 2: Add Features (As Needed)` section. You must also update the `## 📋 Example Setups` section to reflect a common use case with the new feature.

### **New Feature Add-on Template**

Use this template for any new configuration.

````markdown
##### [Emoji] Add [Feature Name]

1.  **Install [Feature] dependencies:**
    ```bash
    npm install -D package-name-1 package-name-2
    ```
2.  **Update `eslint.config.js`:** Add the [Feature] config.

    ```javascript
    import baseConfig from '@pixpilot/dev-config/eslint';
    import featureConfig from '@pixpilot/dev-config/eslint-[feature]'; // 👈 Add this
    // ... other imports
    import prettierConfig from '@pixpilot/dev-config/eslint-prettier';

    export default [
      ...baseConfig,
      // ... other configs
      ...featureConfig, // 👈 Add this
      ...prettierConfig, // Prettier must be last
    ];
    ```

3.  ##### **Create `[new-config-file.js]`** (if applicable)
    ```javascript
    // Content of the new config file
    ```
````

### **Updating Example Setups**

After adding the new feature in "Step 2", you must also update the `## 📋 Example Setups` section. Add a new example or update an existing one to show a common real-world combination that includes your new feature.

For example, if adding a Storybook config, you might add a **"Next.js + Jest + Storybook Project"** example, showing the complete combined installation command and the final `eslint.config.js`.

### **Explanation of Template Fields**

1.  **Heading (`##### [Emoji] Add [Feature Name]`)**: The heading must be a level 5 heading (`#####`) and start with a relevant emoji, the word "Add", and the feature's capitalized name (e.g., "🧪 Add Jest for Testing").
2.  **Dependencies**: List only the **additional** `npm` packages required for this specific feature. Do not include packages from the core setup (like `eslint`, `typescript`, `prettier`).
3.  **Update `eslint.config.js`**: Show the user how to modify their existing `eslint.config.js`. You must show the complete file for context, using `// 👈 Add this` comments to highlight the new import statement and the new entry in the exported array. Ensure the feature config is placed before `prettierConfig`.
4.  **Create New Config File**: If the feature requires a new root-level configuration file (e.g., `jest.config.js`), add a level 5 heading for it (`##### Create [filename]`) and provide its content. If no new file is needed, omit this step.
5.  **Example Setups**: This is a mandatory step. You must demonstrate how the new feature integrates into a complete project setup by updating this section. This provides users with a clear, copy-pasteable example.
