// CLI argument types
export interface CLIArguments {
  tools: string;
  'list-tools': boolean;
  _: (string | number)[];
  $0: string;
}
