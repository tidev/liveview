#! groovy
library 'pipeline-library'

def canPublish = env.BRANCH_NAME == 'next/vite'

buildNPMPackage {
  projectKey = 'TIMOB'
  nodeVersion = '12.18.0'
  publish = canPublish
}
