import assert from "node:assert/strict";

import { env } from "@/lib/env";
import {
  getAdminPasscode,
  getAllowedAdminEmails,
  getExpectedAdminToken,
  isAdminEmail,
  isValidPasscode
} from "@/lib/admin-auth";
import { ADMIN_PASSCODE_LIMITS, isPasscodeLockedOut } from "@/lib/admin-passcode-limit";

function runTests() {
  const originalAdmin = env.ADMIN_EMAILS;
  const originalReviewer = env.COMMUNITY_IMPORT_REVIEWER_EMAILS;
  const originalPasscode = env.ADMIN_PASSCODE;

  try {
    // 1. No built-in passcode: unset means passcode sign-in is off
    env.ADMIN_PASSCODE = undefined;
    assert.equal(getAdminPasscode(), null);
    assert.ok(!isValidPasscode("901008"));
    assert.ok(!isValidPasscode(""));
    assert.ok(!isValidPasscode(null));
    assert.ok(!isValidPasscode(undefined));
    assert.equal(getExpectedAdminToken(), null);

    // A short passcode is refused outright
    env.ADMIN_PASSCODE = "901008";
    assert.equal(getAdminPasscode(), null);
    assert.ok(!isValidPasscode("901008"));
    env.ADMIN_PASSCODE = "fifteen-chars-x";
    assert.equal(getAdminPasscode(), null);

    // A long passcode works, trimmed
    const longPasscode = "a-long-secret-passcode-2026";
    env.ADMIN_PASSCODE = longPasscode;
    assert.ok(isValidPasscode(longPasscode));
    assert.ok(isValidPasscode(`  ${longPasscode}  `));
    assert.ok(!isValidPasscode("901008"));
    assert.ok(!isValidPasscode(`${longPasscode}x`));
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey || "test-service-key";
    assert.ok((getExpectedAdminToken() ?? "").length > 0);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(getExpectedAdminToken(), null);
    if (originalServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    env.ADMIN_PASSCODE = undefined;

    // Wrong-guess limit
    // (counts include the try being checked)
    assert.ok(!isPasscodeLockedOut({ visitor: 1, overall: 1 }));
    assert.ok(!isPasscodeLockedOut({ visitor: ADMIN_PASSCODE_LIMITS.perVisitor, overall: 1 }));
    assert.ok(isPasscodeLockedOut({ visitor: ADMIN_PASSCODE_LIMITS.perVisitor + 1, overall: 1 }));
    assert.ok(!isPasscodeLockedOut({ visitor: 1, overall: ADMIN_PASSCODE_LIMITS.overall }));
    assert.ok(isPasscodeLockedOut({ visitor: 1, overall: ADMIN_PASSCODE_LIMITS.overall + 1 }));

    // 2. Email authorization tests: only ADMIN_EMAILS counts
    env.ADMIN_EMAILS = undefined;
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = "reviewer@haven.com, SecondReviewer@haven.com";
    assert.equal(getAllowedAdminEmails().size, 0);
    assert.ok(!isAdminEmail("reviewer@haven.com"));

    env.ADMIN_EMAILS = "admin1@haven.com, Admin2@haven.com";
    env.COMMUNITY_IMPORT_REVIEWER_EMAILS = "reviewer@haven.com";
    const allowedAdmin = getAllowedAdminEmails();
    assert.equal(allowedAdmin.size, 2);
    assert.ok(isAdminEmail("admin1@haven.com"));
    assert.ok(isAdminEmail("  ADMIN2@HAVEN.COM  "));
    assert.ok(!isAdminEmail("reviewer@haven.com"));
    assert.ok(!isAdminEmail("stranger@haven.com"));
    assert.ok(!isAdminEmail(null));
    assert.ok(!isAdminEmail(""));

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
