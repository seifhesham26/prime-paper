import { useEffect, useRef, useState, useCallback } from "react";

export function useInfiniteScroll<T>(
  initialData: T[],
  fetchNextPage: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
) {
  const [data, setData] = useState<T[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true); // We will update this on first fetch if needed or by initial props

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await fetchNextPage(nextPage);

      setData((prev) => [...prev, ...result.data]);
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error fetching more data:", error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, fetchNextPage]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    // Optional: add a small delay to prevent rapid-fire triggers
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, hasMore, loading]);

  useEffect(() => {
    setData(initialData);
    setPage(1);
    setHasMore(true); // Assuming if initialData changes, we reset
  }, [initialData]);

  return { data, loadMoreRef, loading, hasMore };
}
