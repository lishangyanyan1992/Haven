import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen">
      <div className="content-container py-8">
        <Link href="/">
          <HavenBrand />
        </Link>
      </div>
      <div className="content-container flex items-center justify-center py-10">
        <Card className="w-full max-w-[520px]">
          <CardHeader>
            <div>
              <p className="text-label">Choose a new password</p>
              <CardTitle className="mt-3 text-h1">Update your sign-in details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="field-label">New password</label>
              <Input placeholder="New password" type="password" />
            </div>
            <div>
              <label className="field-label">Confirm password</label>
              <Input placeholder="Confirm password" type="password" />
            </div>
            <Button className="w-full" size="lg">
              Update password
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
