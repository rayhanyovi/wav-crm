import { ChartPie } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const tools = [
  {
    title: "Portfolio Risk Calculator",
    description: "Build a fund allocation and calculate weighted portfolio risk score against the SGA Fund Risk Matrix.",
    icon: ChartPie,
    href: "/tools/portfolio-risk",
    available: true,
  },
];

export function ToolsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tools</h1>
        <p className="text-muted-foreground text-sm mt-1">Adviser utilities and calculators</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Card
            key={tool.title}
            className={`transition-shadow ${tool.available ? "cursor-pointer hover:shadow-md" : "opacity-60 cursor-not-allowed select-none"}`}
            onClick={() => tool.available && navigate(tool.href)}
          >
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-md bg-muted p-2 mt-0.5">
                <tool.icon className={`h-5 w-5 ${tool.available ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{tool.title}</CardTitle>
                <CardDescription className="text-xs mt-1">{tool.description}</CardDescription>
                {!tool.available && (
                  <span className="inline-block mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Coming soon
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
