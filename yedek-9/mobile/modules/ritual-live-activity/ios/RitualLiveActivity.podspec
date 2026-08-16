require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'RitualLiveActivity'
  s.version        = package['version']
  s.summary        = 'LOCAL ritual Live Activity (ActivityKit)'
  s.description    = 'ActivityKit bridge for ritual timer + Dynamic Island'
  s.license        = { :type => 'MIT' }
  s.author         = 'LOCAL'
  s.homepage       = 'https://local.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
