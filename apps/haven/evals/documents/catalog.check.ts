/**
 * Document catalog, presets, custom items, and filename auto-detection.
 *
 * Run: npm run check:document-catalog
 */

export {};

async function main() {
  const {
    findPresetDocument,
    getDefaultRequiredDocuments,
    inferDocumentMetadata,
    slugifyCustomKey,
    validateRequiredDocumentList
  } = await import("@/lib/document-vault");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1. Preset lookup
  const passport = findPresetDocument("passport_biographic_page");
  check("preset lookup: passport", Boolean(passport && passport.label.includes("Passport")), JSON.stringify(passport));
  const i94 = findPresetDocument("i94_record");
  check("preset lookup: i94", Boolean(i94 && i94.label.includes("I-94")), JSON.stringify(i94));
  const missing = findPresetDocument("non_existent_key");
  check("preset lookup: missing returns undefined", missing === undefined, JSON.stringify(missing));

  const defaults = getDefaultRequiredDocuments();
  check("default presets: returns array of default required docs", defaults.length >= 3, `got ${defaults.length}`);

  // 2. Custom key slugification
  check("slugify: standard string", slugifyCustomKey("Updated Resume / CV") === "custom_updated_resume_cv", slugifyCustomKey("Updated Resume / CV"));
  check("slugify: handles special chars", slugifyCustomKey("Marriage Cert (US)!") === "custom_marriage_cert_us", slugifyCustomKey("Marriage Cert (US)!"));

  // 3. Validation of required documents list
  const emptyRes = validateRequiredDocumentList([]);
  check("validation: rejects empty list", !emptyRes.ok, JSON.stringify(emptyRes));

  const validRes = validateRequiredDocumentList([
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "", label: "Updated Resume", isCustom: true }
  ]);
  check("validation: accepts valid preset and custom item", validRes.ok && validRes.items.length === 2, JSON.stringify(validRes));
  if (validRes.ok) {
    check("validation: assigned custom key prefix", validRes.items[1].key.startsWith("custom_"), validRes.items[1].key);
  }

  const dupRes = validateRequiredDocumentList([
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "passport_biographic_page", label: "Passport biographic page duplicate" }
  ]);
  check("validation: deduplicates keys safely", dupRes.ok && dupRes.items[0].key !== dupRes.items[1].key, JSON.stringify(dupRes));

  const preserveKeyRes = validateRequiredDocumentList([
    { key: "custom_existing_key_2", label: "Existing Key Label", isCustom: true }
  ]);
  check("validation: preserves existing custom key", preserveKeyRes.ok && preserveKeyRes.items[0].key === "custom_existing_key_2", JSON.stringify(preserveKeyRes));

  // 4. Filename auto-detection
  const i94Meta = inferDocumentMetadata("most-recent-i-94-arrival.pdf");
  check("infer: i-94 detection", i94Meta.documentKind === "i94_record", JSON.stringify(i94Meta));

  const i20Meta = inferDocumentMetadata("signed-form-i-20.pdf");
  check("infer: i-20 detection", i20Meta.documentKind === "i20_form", JSON.stringify(i20Meta));

  const ds2019Meta = inferDocumentMetadata("j1-ds-2019-signed.pdf");
  check("infer: ds-2019 detection", ds2019Meta.documentKind === "i20_form" && ds2019Meta.displayLabel === "Form DS-2019", JSON.stringify(ds2019Meta));

  const passportMeta = inferDocumentMetadata("my_passport_page.jpg");
  check("infer: passport detection", passportMeta.documentKind === "passport_biographic_page", JSON.stringify(passportMeta));

  const noticeMeta = inferDocumentMetadata("USCIS_I797C_Receipt.pdf");
  check("infer: uscis notice detection", noticeMeta.documentKind === "uscis_notice", JSON.stringify(noticeMeta));

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
