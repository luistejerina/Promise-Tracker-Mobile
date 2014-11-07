angular.module('ptApp.controllers', [])

.controller('HomeCtrl', function($scope, $ionicModal, $http, $state, Survey) {
  $scope.surveys = Survey.surveys;
  $scope.errorMessage = '';
  $scope.surveyLoading = false;

  $ionicModal.fromTemplateUrl(
    'enter-code.html', 
    function(modal){ $scope.codeModal = modal; }, 
    {
      scope: $scope,
      animation: 'slide-in-up',
      focusFirstInput: true
    }
  );

  $scope.countSynced = function(surveyId){
    var filtered = Survey.synced.filter(function(response){
      return response.survey_id == surveyId;
    });
    return filtered.length;
  };

  $scope.removeTemplate = function(surveyId){
     delete Survey.surveys[surveyId];
  };

  $scope.openCodeModal = function(){
    $scope.codeModal.show();
  };

  $scope.closeCodeModal = function(){
    $scope.codeModal.hide();
    $scope.errorMessage = '';
  };

  $scope.fetchSurvey = function(survey){
    $scope.surveyLoading = true;

    var success = function(data){
      Survey.surveys[data.payload.id] = data.payload;
      Survey.surveys[data.payload.id].start_date = new Date(data.payload.start_date).toLocaleDateString();
      localStorage['surveys'] = JSON.stringify(Survey.surveys);
      $scope.surveyLoading = false;
      $scope.codeModal.hide();
      $scope.errorMessage = '';
      $state.go($state.current, {}, {reload: true});
    };

    var error = function(error_code){
      $scope.surveyLoading = false;
      $scope.errorMessage = (error_code.toString());
    };

    if(survey && survey.code){
      Survey.fetchSurvey(survey.code, success, error);
    } else {
      $scope.surveyLoading = false;
      $scope.errorMessage = 'ENTER_CODE';
    }
  };

  $scope.getUnsynced = function(){
    return Survey.unsynced.length;
  };

  $scope.syncSurveys = function(){
    Survey.syncResponses();
  };
})

.controller('EndCtrl', function($scope, $stateParams, $state, $location, $http, Survey) {
  $scope.survey = Survey.surveys[$stateParams.surveyId];

  $scope.submitResponse = function(){
    Survey.currentResponse.timestamp = Date.now();
    Survey.syncResponse(Survey.currentResponse);
    $state.go('home');
  };

  $scope.saveResponse = function(){
    Survey.currentResponse.timestamp = Date.now();
    Survey.addToUnsynced(Survey.currentResponse);
    $state.go('home');
  };

  $scope.backToSurvey = function(){
    $state.go('input', {
      surveyId: $stateParams.surveyId, 
      inputId: Survey.currentResponse.inputs.length - 1
    });
  };

  $scope.cancelResponse = function(){
    Survey.currentResponse = {};
    $state.go('home');
  };
})

.controller('UsersCtrl', function($scope, $stateParams, $state, $location, $ionicModal, Survey, User) {
  $scope.surveys = Object.keys(Survey.surveys);
  $scope.responses = Survey.synced;
  $scope.user = User.user;

  $ionicModal.fromTemplateUrl(
    'user-info.html', 
    function(modal){ $scope.userModal = modal; }, 
    {
      scope: $scope,
      animation: 'slide-in-up',
      focusFirstInput: true
    }
  );

  $scope.deleteSurveys = function() {
    Survey.surveys = {};
    localStorage['surveys'] = '{}'
  };

  $scope.openUserModal = function(){
    $scope.userModal.show();
  };

  $scope.closeUserModal = function(){
    $scope.userModal.hide();
  };

  $scope.updateUser = function(){
    User.updateInfo();
    $scope.userModal.hide();
  };
})

.controller('SurveysCtrl', function($scope, $stateParams, $state, $location, Survey) {
  $scope.survey = Survey.surveys[$stateParams.surveyId];

  $scope.startSurvey = function(){
    Survey.queueNewResponse($stateParams.surveyId);
    $state.transitionTo('input', {
      surveyId: $stateParams.surveyId, 
      inputId: Survey.currentResponse.inputs[Survey.currentResponse.activeIndex].id
    })
  };
})

.controller('InputsCtrl', function($scope, $stateParams, $state, Survey, $ionicPopup, $filter){
  $scope.survey = Survey.surveys[$stateParams.surveyId];
  $scope.index = Survey.currentResponse.activeIndex;
  $scope.input = Survey.currentResponse.inputs[Survey.currentResponse.activeIndex];
  $scope.input.input_type == 'select' ? $scope.input.answer = $scope.input.answer || [] : false;

  $scope.getImage = function(){
    var onSuccess = function(imageURI){
      $scope.input.answer = imageURI;
      $state.go($state.current, {}, {reload: true});
    };
    var onError = function(){};

    navigator.camera.getPicture(onSuccess, onError, {
      limit: 1,
      quality: 50,
      destinationType: Camera.DestinationType.FILE_URI,
      correctOrientation: true
    });
  };

  $scope.getLocation = function(){
    $scope.input.answer = $scope.input.answer || {};
    $scope.input.msg = 'Getting Location...';

    navigator.geolocation.getCurrentPosition(function(position){
      $scope.input.answer.lon = position.coords.longitude;
      $scope.input.answer.lat = position.coords.latitude;
      $scope.input.msg = '';
      $state.go($state.current, {}, {reload: true});
    });
  };

  $scope.validateRequired = function(input){
    if(input.required == true){
      switch(input.input_type){
        case "location":
          return input.answer.lat != undefined && input.answer.lon != undefined;
          break;
        case "select":
        case "select1":
          return input.answer.filter(function(i) { return i == true;}).length > 0
          break;
        default:
          return input.answer && input.answer.length > 0;
          break;
      }
    } else {
      return true;
    }
  };

  $scope.nextPrompt = function(currentInput){
    if($scope.validateRequired(currentInput)){
      if(Survey.currentResponse.activeIndex < (Survey.currentResponse.inputs.length - 1)){
        Survey.currentResponse.activeIndex += 1;
        $state.transitionTo('input', {
          surveyId: $stateParams.surveyId,
          inputId: Survey.currentResponse.inputs[Survey.currentResponse.activeIndex].id
        });
      } else {
        $state.go('survey-end', {surveyId:  $scope.survey.id});
      }
    } else {
      // TODO: Insert notification here
      $scope.errorMessage = 'REQUIRED';
      console.log('REQUIRED');
    }
  };

  $scope.previousPrompt = function(){
    if(Survey.currentResponse.activeIndex > 0){
      Survey.currentResponse.activeIndex -= 1;
      $state.go('input', {
        surveyId: $stateParams.surveyId, 
        inputId: Survey.currentResponse.inputs[Survey.currentResponse.activeIndex.id]
      });
    }
  };

  $scope.cancelResponse = function() {
    var confirmPopup = $ionicPopup.confirm({
      title: $filter('translate')('CANCEL_RESPONSE'),
      template: $filter('translate')('CONFIRM_CANCEL'),
      buttons: [
        {
          text: $filter('translate')('CANCEL')
        },
        {
          text: $filter('translate')('DELETE'),
          type: 'button-pink',
          onTap: function(){ return true; }
        }
      ]
    });
    confirmPopup.then(function(res) {
      if(res) {
        Survey.currentResponse = {};
        $state.go('home');
      }
    });
  };
});