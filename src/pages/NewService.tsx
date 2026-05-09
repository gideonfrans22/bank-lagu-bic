import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewService() {
  const navigate = useNavigate();
  const [date, setDate] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    navigate(`/service/${date}`);
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Choose a Sunday</CardTitle>
        <CardDescription>Select the service date to open or create that week’s setlist.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="svc-date">Service date</Label>
            <Input id="svc-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button type="submit">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
