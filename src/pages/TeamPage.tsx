import { useNavigate } from "react-router-dom";
import { useCrmStore } from "@/store/useCrmStore";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/common/StatusBadge";
import { formatDuration } from "@/lib/format";

export function TeamPage() {
  const { users, activities, deals } = useCrmStore();
  const navigate = useNavigate();

  const teamMembers = users.filter((u) => u.role !== "VIEWER");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Team</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member) => {
          const memberActivities = activities.filter((a) => a.created_by === member.id && !a.deleted_at);
          const calls = memberActivities.filter((a) => a.type === "CALL");
          const pickups = calls.filter((a) => a.result !== "NO_ANSWER" && a.result !== "CANCELLED");
          const pickupRate = calls.length > 0 ? Math.round((pickups.length / calls.length) * 100) : 0;
          const dialerSeconds = calls.reduce((acc, a) => acc + ((a.metadata?.duration_seconds as number) || 0), 0);
          const openDeals = deals.filter((d) => d.assigned_to_id === member.id && !d.deleted_at && d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST");
          const wonDeals = deals.filter((d) => d.assigned_to_id === member.id && d.stage === "CLOSED_WON");

          return (
            <Card key={member.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/team/${member.id}`)}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-base">{member.avatar || member.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{member.name}</p>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        ["Calls Made", calls.length],
                        ["Pickup Rate", `${pickupRate}%`],
                        ["Dialer Time", formatDuration(dialerSeconds)],
                        ["Open Deals", openDeals.length],
                        ["Total Activities", memberActivities.length],
                        ["Won Deals", wonDeals.length],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{label}</td>
                          <td className="px-3 py-2 text-right font-semibold">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
