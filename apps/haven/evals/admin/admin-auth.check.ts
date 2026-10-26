import assert from "node:assert/strict";

import { env } from "@/lib/env";
import { getAllowedAdminEmails, isAdminEmail } from "@/lib/admin-auth";

function runTests() {
  // Test fallback to COMMUNITY_IMPORT_REVIEWER_EMAILS when ADMIN_EMAILS is empty
  const originalAdmin = env.ADMIN_EMAILS;
  const originalReviewer = env.COMMUNITY_IMPORT_REVIEWER_EMAILS;

  try {
    env.ADMIN_EMAILS = undefined;
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = "reviewer@haven.com, SecondReviewer@haven.com";

    const allowedFallback = getAllowedAdminEmails();
    assert.equal(allowedFallback.size, 2);
    assert.ok(isAdminEmail("reviewer@haven.com"));
    assert.ok(isAdminEmail("secondreviewer@haven.com"));
    assert.ok(isAdminEmail("  SECONDREVIEWER@HAVEN.COM  "));
    assert.ok(!isAdminEmail("stranger@haven.com"));
    assert.ok(!isAdminEmail(null));
    assert.ok(!isAdminEmail(""));

    // Test ADMIN_EMAILS precedence
    env.ADMIN_EMAILS = "admin1@haven.com, admin2@haven.com";
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = "reviewer@haven.com";

    const allowedAdmin = getAllowedAdminEmails();
    assert.equal(allowedAdmin.size, 2);
    assert.ok(isAdminEmail("admin1@haven.com"));
    assert.ok(isAdminEmail("admin2@haven.com"));
    // When ADMIN_EMAILS is set, reviewer alone does not grant admin
    assert.ok(!isAdminEmail("reviewer@haven.com"));

    // Test empty configurations
    env.ADMIN_EMAILS = "";
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = "";
    assert.equal(getAllowedAdminEmails().size, 0);
    assert.ok(!isAdminEmail("admin1@haven.com"));

    console.log("✓ Admin auth tests passed successfully.");
  } finally {
    env.ADMIN_EMAILS = originalAdmin;
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = originalReviewer;
  }
}

runTests();
