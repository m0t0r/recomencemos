"use client";

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import { Button } from "@repo/design-system/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/card";
import { Checkbox } from "@repo/design-system/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Separator } from "@repo/design-system/components/separator";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { toast } from "@repo/design-system/components/sonner";
import { Switch } from "@repo/design-system/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/tabs";
import { SparklesIcon } from "lucide-react";

export function Showcase() {
  return (
    <Tabs defaultValue="components" className="gap-6">
      <TabsList>
        <TabsTrigger value="components">Components</TabsTrigger>
        <TabsTrigger value="forms">Forms</TabsTrigger>
        <TabsTrigger value="loading">Loading</TabsTrigger>
      </TabsList>

      <TabsContent value="components">
        <Card>
          <CardHeader>
            <CardTitle>Primitives</CardTitle>
            <CardDescription>
              Button variants, badges, and overlays, all reading from the same tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Avatar>
                <AvatarFallback>DS</AvatarFallback>
              </Avatar>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => toast("Design system wired up.")}>
                <SparklesIcon data-icon="inline-start" />
                Fire a toast
              </Button>
              <Dialog>
                <DialogTrigger render={<Button variant="outline">Open a dialog</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Replace me</DialogTitle>
                    <DialogDescription>
                      This dialog is scaffolding. Swap it for the first real flow in your product.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Continue</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="forms">
        <Card>
          <CardHeader>
            <CardTitle>Form primitives</CardTitle>
            <CardDescription>
              Layout comes from <code className="font-mono">FieldGroup</code> and{" "}
              <code className="font-mono">Field</code> — never a hand-rolled stack.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="project">Project name</FieldLabel>
                <Input id="project" placeholder="acme-web" />
                <FieldDescription>Shown in the dashboard and in deploy logs.</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="preview" defaultChecked />
                <FieldLabel htmlFor="preview">Deploy previews on every pull request</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch id="telemetry" />
                <FieldLabel htmlFor="telemetry">Send anonymous usage telemetry</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="loading">
        <Card>
          <CardHeader>
            <CardTitle>Loading states</CardTitle>
            <CardDescription>
              Cache Components streams the dynamic parts in — these are the fallbacks.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
