import assert from "node:assert/strict";

import { env } from "@/lib/env";
import {
  DEFAULT_ADMIN_PASSCODE,
  getAllowedAdminEmails,
  getExpectedAdminToken,
  isAdminEmail,
  isValidPasscode
} from "@/lib/admin-auth";

function runTests() {
  // Test fallback to COMMUNITY_IMPORT_REVIEWER_EMAILS when ADMIN_EMAILS is empty
  const originalAdmin = env.ADMIN_EMAILS;
  const originalReviewer = env.COMMUNITY_IMPORT_REVIEWER_EMAILS;
  const originalPasscode = env.ADMIN_PASSCODE;

  try {
    // 1. Passcode verification tests
    assert.equal(DEFAULT_ADMIN_PASSCODE, "901008");
    env.ADMIN_PASSCODE = undefined;
    assert.ok(isValidPasscode("901008"));
    assert.ok(isValidPasscode("  901008  "));
    assert.ok(!isValidPasscode("123456"));
    assert.ok(!isValidPasscode(""));
    assert.ok(!isValidPasscode(null));
    assert.ok(!isValidPasscode(undefined));

    // Custom passcode override
    env.ADMIN_PASSCODE = "secret-pass-789";
    assert.ok(isValidPasscode("secret-pass-789"));
    assert.ok(!isValidPasscode("901008"));
    assert.ok(getExpectedAdminToken().length > 0);
    env.ADMIN_PASSCODE = undefined;

    // 2. Email authorization tests
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
    env.ADMIN_PASSCODE = originalPasscode;
  }
}

runTests();
