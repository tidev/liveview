import fs from 'fs-extra';
import path from 'path';
import tempy from 'tempy';

export function getTemplatePath(name: string): string {
  return path.join(__dirname, '..', 'fixtures', name);
}

export class TestHelper {
  public tmpDir: string

  constructor() {
    this.tmpDir = tempy.directory();
  }

  async copyFromTemplate(name: string): Promise<void> {
    await fs.copy(getTemplatePath(name), this.tmpDir);
  }

  async afterEach(): Promise<void> {
    await fs.emptyDir(this.tmpDir);
  }

  async delay(ms = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  writeFile(name: string): void {
    fs.writeFileSync(path.join(this.tmpDir, name), Math.random().toString(), 'utf-8');
  }

  remove(name: string): void {
    fs.removeSync(path.join(this.tmpDir, name));
  }
}
