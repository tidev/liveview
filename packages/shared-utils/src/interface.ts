export interface TranspileTargets {
  chrome?: string
  ios?: string
  [key: string]: string | undefined
}

export type ProjectType = 'alloy' | 'classic' | 'webpack';
