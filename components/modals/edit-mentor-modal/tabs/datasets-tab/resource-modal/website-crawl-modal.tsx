
import { ResourceType } from "../resource-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useWebsiteCrawlerResource } from "@/hooks/use-website-crawler-resource";

type Props = {
  resource: ResourceType;
};

export function WebsiteCrawlModal({ resource }: Props) {

  const {
    form,
    handleCheckUrlIsValid,
    crawlerMatchPatterns,
    setCrawlerMatchPatterns,
  } = useWebsiteCrawlerResource(resource);

  return (
    <Card className="w-full max-w-2xl mx-auto" role="dialog" aria-labelledby="crawler-title" aria-describedby="crawler-description">
      <CardHeader>
        <CardTitle id="crawler-title" className="text-md font-semibold text-gray-600">
          Web Crawler Configuration
        </CardTitle>
        <p id="crawler-description" className="text-sm text-muted-foreground">
          Configure your web crawler settings and URL patterns
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          aria-label="Web crawler configuration form"
        >
          <>
            <form.Field
              name="url"
              validators={{
                onChange: ({ value }) =>
                  (!value && "URL is required") ||
                  (!handleCheckUrlIsValid(value) && "Invalid URL"),
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>URL</Label>
                  <Input
                    id={field.name}
                    type="url"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://example.com"
                    aria-describedby={field.state.meta.errors ? `${field.name}-error` : undefined}
                    aria-invalid={!!field.state.meta.errors}
                    aria-required="true"
                  />
                  {field.state.meta.errors && (
                    <p id={`${field.name}-error`} className="text-sm text-destructive mb-2" role="alert">
                      {field.state.meta.errors}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="crawler_max_depth"
                validators={{
                  onChange: ({ value }) =>
                    (!value && "Field is required") ||
                    (value < 1 && "Must be greater than 0") ||
                    (value > 10000 && "Must be less than 10000"),
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Max Crawl Depth</Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      max="10000"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Number.parseInt(e.target.value))
                      }
                      aria-describedby={field.state.meta.errors ? `${field.name}-error` : undefined}
                      aria-invalid={!!field.state.meta.errors}
                      aria-required="true"
                    />
                    {field.state.meta.errors && (
                      <p id={`${field.name}-error`} className="text-sm text-destructive mb-2" role="alert">
                        {field.state.meta.errors}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field
                name="crawler_max_pages_limit"
                validators={{
                  onChange: ({ value }) =>
                    (!value && "Field is required") ||
                    (value < 1 && "Must be greater than 0"),
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Max Pages Limit</Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Number.parseInt(e.target.value))
                      }
                      aria-describedby={field.state.meta.errors ? `${field.name}-error` : undefined}
                      aria-invalid={!!field.state.meta.errors}
                      aria-required="true"
                    />
                    {field.state.meta.errors && (
                      <p id={`${field.name}-error`} className="text-sm text-destructive mb-2" role="alert">
                        {field.state.meta.errors}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>
            <form.Field
              name="crawler_pattern_type"
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="pattern-type">Pattern Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger id="pattern-type" aria-label="Select pattern type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glob">Glob Pattern</SelectItem>
                      <SelectItem value="regex">Regular Expression</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <form.Subscribe
              selector={(state) => [
                state.values.temp_crawler_match_patterns,
                state.values.crawler_pattern_type,
              ]}
            >
              {([tempCrawlerMatchPatterns, crawlerPatternType]) => (
                <form.Field
                  name="temp_crawler_match_patterns"
                  validators={{
                    onChange: ({ value }) =>
                      value &&
                      crawlerPatternType === "glob" &&
                      !handleCheckUrlIsValid(value) &&
                      "Invalid URL",
                  }}
                >
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor="pattern-input">Crawler Match Patterns</Label>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            id="pattern-input"
                            value={tempCrawlerMatchPatterns}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (tempCrawlerMatchPatterns.trim()) {
                                  setCrawlerMatchPatterns([
                                    ...crawlerMatchPatterns,
                                    tempCrawlerMatchPatterns,
                                  ]);
                                  field.handleChange("");
                                }
                              }
                            }}
                            placeholder={
                              crawlerPatternType === "glob"
                                ? "https://example.com/"
                                : "(http|https)://www.example.com/(.*)"
                            }
                            className="flex-1"
                            aria-describedby={field.state.meta.errors ? "pattern-error" : "pattern-help"}
                            aria-invalid={!!field.state.meta.errors}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (tempCrawlerMatchPatterns.trim()) {
                                setCrawlerMatchPatterns([
                                  ...crawlerMatchPatterns,
                                  tempCrawlerMatchPatterns,
                                ]);
                                field.handleChange("");
                              }
                            }}
                            disabled={!String(tempCrawlerMatchPatterns).trim()}
                            size="sm"
                            aria-label="Add pattern"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {field.state.meta.errors && (
                          <p id="pattern-error" className="text-sm text-destructive mb-2" role="alert">
                            {field.state.meta.errors}
                          </p>
                        )}
                        <p id="pattern-help" className="text-sm text-muted-foreground">
                          Press Enter or click the plus button to add a pattern
                        </p>
                        <div 
                          className="flex flex-wrap gap-2 min-h-[2rem] p-2 border rounded-md bg-muted/50"
                          role="list"
                          aria-label="Added crawler match patterns"
                        >
                          {crawlerMatchPatterns.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                              No patterns added
                            </span>
                          ) : (
                            crawlerMatchPatterns.map((pattern, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="flex items-center gap-1"
                                role="listitem"
                              >
                                <span className="text-xs">{pattern}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCrawlerMatchPatterns(
                                      crawlerMatchPatterns.filter(
                                        (p) => p !== pattern
                                      )
                                    )
                                  }
                                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                  aria-label={`Remove pattern: ${pattern}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </form.Field>
              )}
            </form.Subscribe>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
            >
              {([isSubmitting]) => (
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-sm text-white hover:text-white hover:opacity-90"
                    disabled={isSubmitting}
                    aria-describedby={isSubmitting ? "submitting-status" : undefined}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                  {isSubmitting && (
                    <div id="submitting-status" className="sr-only" role="status" aria-live="polite">
                      Form is being submitted
                    </div>
                  )}
                </div>
              )}
            </form.Subscribe>
          </>
        </form>
      </CardContent>
    </Card>
  );
}
