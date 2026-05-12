import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { ReviewCreateInput, SourceUpdateInput, SourceWriteInput } from "../lib/api";

export const queryKeys = {
  health: ["health"] as const,
  stats: ["stats"] as const,
  sources: (page: number, limit: number) => ["sources", page, limit] as const,
  articles: (page: number, limit: number, status: string) =>
    ["articles", page, limit, status] as const,
  article: (id: string) => ["article", id] as const,
  clusters: (page: number, limit: number) => ["clusters", page, limit] as const,
  cluster: (id: string) => ["cluster", id] as const,
  summaries: (page: number, limit: number) => ["summaries", page, limit] as const,
  published: (page: number, limit: number) => ["published", page, limit] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    refetchInterval: 5000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: api.stats,
    refetchInterval: 10000,
  });
}

export function useSources(page = 1, limit = 50) {
  return useQuery({
    queryKey: queryKeys.sources(page, limit),
    queryFn: () => api.sources(page, limit),
    placeholderData: keepPreviousData,
  });
}

export function useArticles(page: number, limit = 20, status = "") {
  return useQuery({
    queryKey: queryKeys.articles(page, limit, status),
    queryFn: () => api.articles(page, limit, status || undefined),
    placeholderData: keepPreviousData,
    refetchInterval: 8000,
  });
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: queryKeys.article(id),
    queryFn: () => api.article(id),
    enabled: id.length > 0,
  });
}

export function useClusters(page: number, limit = 20) {
  return useQuery({
    queryKey: queryKeys.clusters(page, limit),
    queryFn: () => api.clusters(page, limit),
    placeholderData: keepPreviousData,
    refetchInterval: 8000,
  });
}

export function useCluster(id: string) {
  return useQuery({
    queryKey: queryKeys.cluster(id),
    queryFn: () => api.cluster(id),
    enabled: id.length > 0,
    refetchInterval: 8000,
  });
}

export function useSummaries(page: number, limit = 20) {
  return useQuery({
    queryKey: queryKeys.summaries(page, limit),
    queryFn: () => api.summaries(page, limit),
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
  });
}

export function usePublished(page: number, limit = 20) {
  return useQuery({
    queryKey: queryKeys.published(page, limit),
    queryFn: () => api.published(page, limit),
    placeholderData: keepPreviousData,
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SourceWriteInput) => api.createSource(payload),
    onSuccess: () => {
      toast.success("Source created");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SourceUpdateInput }) =>
      api.updateSource(id, payload),
    onSuccess: () => {
      toast.success("Source updated");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSource(id),
    onSuccess: () => {
      toast.success("Source removed");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateArticleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "fetched" | "approved" | "rejected" }) =>
      api.updateArticleStatus(id, status),
    onSuccess: (_, variables) => {
      toast.success(`Article marked ${variables.status}`);
      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      void queryClient.invalidateQueries({ queryKey: ["clusters"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAddReview(clusterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReviewCreateInput) => api.addReview(clusterId, payload),
    onSuccess: () => {
      toast.success("Review recorded");
      void queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId) });
      void queryClient.invalidateQueries({ queryKey: ["clusters"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePublishCluster(clusterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug?: string) => api.publishCluster(clusterId, slug),
    onSuccess: () => {
      toast.success("Cluster published");
      void queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId) });
      void queryClient.invalidateQueries({ queryKey: ["clusters"] });
      void queryClient.invalidateQueries({ queryKey: ["published"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
