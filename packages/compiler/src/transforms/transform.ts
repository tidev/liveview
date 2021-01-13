export interface Transform {
  apply(file: string, content: string): Promise<string>
}
