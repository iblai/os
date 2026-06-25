import { ResourceType } from '../resource-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useWebsiteCrawlerResource } from '@/hooks/use-website-crawler-resource';
import { useTranslations } from 'next-intl';

type Props = {
  resource: ResourceType;
};

export function WebsiteCrawlModal({ resource }: Props) {
  const t = useTranslations('resourceModalWebsiteCrawlModal');
  const {
    form,
    handleCheckUrlIsValid,
    crawlerMatchPatterns,
    setCrawlerMatchPatterns,
  } = useWebsiteCrawlerResource(resource);

  return (
    <Card
      className="mx-auto w-full max-w-2xl"
      role="dialog"
      aria-labelledby="crawler-title"
      aria-describedby="crawler-description"
    >
      <CardHeader>
        <CardTitle
          id="crawler-title"
          className="text-md font-semibold text-gray-600"
        >
          {t('title')}
        </CardTitle>
        <p id="crawler-description" className="text-muted-foreground text-sm">
          {t('description')}
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
          aria-label={t('formAriaLabel')}
        >
          <>
            <form.Field
              name="url"
              validators={{
                onChange: ({ value }) =>
                  (!value && t('urlRequired')) ||
                  (!handleCheckUrlIsValid(value) && t('invalidUrl')),
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>{t('urlLabel')}</Label>
                  <Input
                    id={field.name}
                    type="url"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://example.com"
                    aria-describedby={
                      field.state.meta.errors
                        ? `${field.name}-error`
                        : undefined
                    }
                    aria-invalid={!!field.state.meta.errors}
                    aria-required="true"
                  />
                  {field.state.meta.errors && (
                    <p
                      id={`${field.name}-error`}
                      className="text-destructive mb-2 text-sm"
                      role="alert"
                    >
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
                    (!value && t('fieldRequired')) ||
                    (value < 1 && t('mustBeGreaterThanZero')) ||
                    (value > 10000 && t('mustBeLessThan10000')),
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>
                      {t('maxCrawlDepthLabel')}
                    </Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      max="10000"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Number.parseInt(e.target.value))
                      }
                      aria-describedby={
                        field.state.meta.errors
                          ? `${field.name}-error`
                          : undefined
                      }
                      aria-invalid={!!field.state.meta.errors}
                      aria-required="true"
                    />
                    {field.state.meta.errors && (
                      <p
                        id={`${field.name}-error`}
                        className="text-destructive mb-2 text-sm"
                        role="alert"
                      >
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
                    (!value && t('fieldRequired')) ||
                    (value < 1 && t('mustBeGreaterThanZero')),
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>
                      {t('maxPagesLimitLabel')}
                    </Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Number.parseInt(e.target.value))
                      }
                      aria-describedby={
                        field.state.meta.errors
                          ? `${field.name}-error`
                          : undefined
                      }
                      aria-invalid={!!field.state.meta.errors}
                      aria-required="true"
                    />
                    {field.state.meta.errors && (
                      <p
                        id={`${field.name}-error`}
                        className="text-destructive mb-2 text-sm"
                        role="alert"
                      >
                        {field.state.meta.errors}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>
            <form.Field name="crawler_pattern_type">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="pattern-type">{t('patternTypeLabel')}</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger
                      id="pattern-type"
                      aria-label={t('selectPatternTypeAriaLabel')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glob">{t('globPattern')}</SelectItem>
                      <SelectItem value="regex">
                        {t('regularExpression')}
                      </SelectItem>
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
                      crawlerPatternType === 'glob' &&
                      !handleCheckUrlIsValid(value) &&
                      t('invalidUrl'),
                  }}
                >
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor="pattern-input">
                        {t('crawlerMatchPatternsLabel')}
                      </Label>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            id="pattern-input"
                            value={tempCrawlerMatchPatterns}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (tempCrawlerMatchPatterns.trim()) {
                                  setCrawlerMatchPatterns([
                                    ...crawlerMatchPatterns,
                                    tempCrawlerMatchPatterns,
                                  ]);
                                  field.handleChange('');
                                }
                              }
                            }}
                            placeholder={
                              crawlerPatternType === 'glob'
                                ? 'https://example.com/'
                                : '(http|https)://www.example.com/(.*)'
                            }
                            className="flex-1"
                            aria-describedby={
                              field.state.meta.errors
                                ? 'pattern-error'
                                : 'pattern-help'
                            }
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
                                field.handleChange('');
                              }
                            }}
                            disabled={!String(tempCrawlerMatchPatterns).trim()}
                            size="sm"
                            aria-label={t('addPatternAriaLabel')}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {field.state.meta.errors && (
                          <p
                            id="pattern-error"
                            className="text-destructive mb-2 text-sm"
                            role="alert"
                          >
                            {field.state.meta.errors}
                          </p>
                        )}
                        <p
                          id="pattern-help"
                          className="text-muted-foreground text-sm"
                        >
                          {t('patternHelpText')}
                        </p>
                        <div
                          className="bg-muted/50 flex min-h-[2rem] flex-wrap gap-2 rounded-md border p-2"
                          role="list"
                          aria-label={t('addedPatternsAriaLabel')}
                        >
                          {crawlerMatchPatterns.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              {t('noPatternsAdded')}
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
                                        (p) => p !== pattern,
                                      ),
                                    )
                                  }
                                  className="hover:bg-destructive/20 ml-1 rounded-full p-0.5"
                                  aria-label={t('removePatternAriaLabel', {
                                    pattern,
                                  })}
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
            <form.Subscribe selector={(state) => [state.isSubmitting]}>
              {([isSubmitting]) => (
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-sm text-white hover:text-white hover:opacity-90"
                    disabled={isSubmitting}
                    aria-describedby={
                      isSubmitting ? 'submitting-status' : undefined
                    }
                  >
                    {isSubmitting ? t('submitting') : t('submit')}
                  </Button>
                  {isSubmitting && (
                    <div
                      id="submitting-status"
                      className="sr-only"
                      role="status"
                      aria-live="polite"
                    >
                      {t('formBeingSubmitted')}
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
