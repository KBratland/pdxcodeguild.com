from django.http import HttpResponse, HttpResponseRedirect
from django.template import RequestContext, Context
from django.shortcuts import render_to_response
from django.core.mail import send_mail, BadHeaderError
from .forms import Comment, Contact, StudentIntakeForm, NewStudentApp


def index(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('index.html', context_dict, context)


def about(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('about.html', context_dict, context)


def advisors(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('advisors.html', context_dict, context)


def apply(request):
    context = RequestContext(request)
    if request.method == 'GET':
        form = Contact()
    else:
        # A POST request: Handle Form Upload
        form = Contact(request.POST)  # Bind data from request.POST into a PostForm

        # If data is valid, proceeds to create a new post and redirect the user
        if form.is_valid():
            full_name = form.cleaned_data['full_name']
            phone_number = form.cleaned_data['phone_number']
            email_address = form.cleaned_data['email_address']
            best_contact = form.cleaned_data['best_contact']
            message = form.cleaned_data['message']

            from django.core.mail import EmailMultiAlternatives

            subject, from_email, to = '%s filled out the Interested form' % full_name, 'forms@pdxcodeguild.com', \
                                      'sheri.dover@gmail.com'
            text_content = '''Name: %s
            Phone number: %s
            Email address: %s
            How do you prefer to be contacted? %s
            Message: \n %s''' % (full_name, phone_number, email_address, best_contact, message)
            html_content = 'Full name: %s<br>Phone number: %s<br>Email address: %s<br>How do you prefer to be ' \
                           'contacted? %s<br>Message:<br> %s' % (
                               full_name, phone_number, email_address, best_contact, message)
            msg = EmailMultiAlternatives(subject, text_content, from_email, [to])
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            return HttpResponseRedirect('/thanks/')
    context_dict = {'form': form}

    return render_to_response('apply.html', context_dict, context)


def intake(request):
    context = RequestContext(request)
    if request.method == 'GET':
        form = StudentIntakeForm()
    else:
        # A POST request: Handle Form Upload
        form = StudentIntakeForm(request.POST)  # Bind data from request.POST into a PostForm

        # If data is valid, proceeds to create a new post and redirect the user
        if form.is_valid():
            name = form.cleaned_data['name']
            email_address = form.cleaned_data['email_address']
            git_hub = form.cleaned_data['git_hub']
            student_bio = form.cleaned_data['student_bio']
            student_goals = form.cleaned_data['student_goals']
            form.save()
            from django.core.mail import EmailMultiAlternatives

            subject, from_email, to = '%s filled out the student intake form' % name, 'forms@pdxcodeguild.com', \
                                      'chris.charles.jones@gmail.com',
            text_content = '''Name: %s
            Email address: %s
            GitHub URL: %s
            Student Bio: \n %s
            Student Goals: \n %s''' % (name, email_address, git_hub, student_bio, student_goals)
            html_content = 'Name: %s<br>Email address: %s<br>GitHub URL: %s<br>Student Bio<br>' \
                           '%s<br>Student Goals:<br>%s' % (
                               name, email_address, git_hub, student_bio, student_goals
                           )
            msg = EmailMultiAlternatives(subject, text_content, from_email, [to])
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            return HttpResponseRedirect('/thanks/')
    context_dict = {'form': form}

    return render_to_response('intake.html', context_dict, context)


def contact(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('contact.html', context_dict, context)


def faq(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('faq.html', context_dict, context)


def gettechnical(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('gettechnical.html', context_dict, context)


def individualized(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('individualized.html', context_dict, context)


def jrdevbootcamp(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('jrdevbootcamp.html', context_dict, context)


def evening_bootcamp(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('evening-bootcamp.html', context_dict, context)


def partner(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('partner.html', context_dict, context)


def program(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('program.html', context_dict, context)


def sponsor(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('sponsor.html', context_dict, context)


def team(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('team.html', context_dict, context)


def thanks(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('thanks.html', context_dict, context)


def value(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('value.html', context_dict, context)


def ppm(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('ppm.html', context_dict, context)


def pythonquiz(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('pythonquiz.html', context_dict, context)

def student_comment(request):
    context = RequestContext(request)
    if request.method == 'GET':
        form = Comment()
    else:
        # A POST request: Handle Form Upload
        form = Comment(request.POST)  # Bind data from request.POST into a PostForm

        # If data is valid, proceeds to create a new post and redirect the user
        if form.is_valid():
            name = form.cleaned_data['name']
            email_address = form.cleaned_data['email_address']
            first = form.cleaned_data['first']
            second = form.cleaned_data['second']
            third = form.cleaned_data['third']
            fourth = form.cleaned_data['fourth']
            fifth = form.cleaned_data['fifth']
            sixth = form.cleaned_data['sixth']
            seventh = form.cleaned_data['seventh']
            eighth = form.cleaned_data['eighth']
            ninth = form.cleaned_data['ninth']
            tenth = form.cleaned_data['tenth']
            message1 = form.cleaned_data['message1']
            message2 = form.cleaned_data['message2']

            from django.core.mail import EmailMultiAlternatives

            subject, from_email, to = 'A new student comment form has been filled out.', 'forms@pdxcodeguild.com',\
                                      'chris.charles.jones@gmail.com'
            text_content = '''Name: %s
            Email address: %s
            Please rate the following on a scale of 1 to 4.
            1 = Poor, 2 = Fair, 3 = Good, 4 = Excellent
            Depth of the Knowledge of the subject: %s
            Presentation Skills: %s
            Sincerity, Commitment, Regularity and Punctuality: %s
            Syllabus Coverage: %s
            Ability to Clarify doubts, teaching with relevant examples: %s
            Ability to relate the course to real life situations: %s
            Ability to generate interest: %s
            Content and length of lectures: %s
            Ability to command and control the class: %s
            Overall teacher rating: %s
            What can we do in the future to improve this class?: \n %s \n
            Is there any other suggestion or issues you would like to bring up?: \n %s
            ''' % (name, email_address, first, second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth, message1, message2)
            html_content = 'Name: %s<br>Email address: %s<br>Please rate the following on a scale of 1 to 4.<br>1 = Poor, 2 = Fair, 3 = Good, 4 = Excellent<br>Depth of the Knowledge of the subject: %s<br>Presentation Skills: %s<br>Sincerity, Commitment, Regularity and Punctuality: %s<br>Syllabus Coverage: %s<br>Ability to Clarify doubts, teaching with relevant examples: %s<br>Ability to relate the course to real life situations: %s<br>Ability to generate interest: %s<br>Content and length of lectures: %s<br>Ability to command and control the class: %s<br>Overall teacher rating: %s<br>What can we do in the future to improve this class?: <br>%s <br>Is there any other suggestion or issues you would like to bring up?: <br>%s' % (name, email_address, first, second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth, message1, message2)
            msg = EmailMultiAlternatives(subject, text_content, from_email, [to])
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            return HttpResponseRedirect('/thanks/')
    context_dict = {'form': form}

    return render_to_response('comment.html', context_dict, context)


def student(request):
    context = RequestContext(request)
    context_dict = {}

    return render_to_response('student.html', context_dict, context)


def student_apply(request):
    context = RequestContext(request)
    if request.method == 'GET':
        form = NewStudentApp()
    else:
        # A POST request: Handle Form Upload
        form = NewStudentApp(request.POST)  # Bind data from request.POST into a PostForm

        # If data is valid, proceeds to create a new post and redirect the user
        if form.is_valid():
            form.save()
            return HttpResponseRedirect('/thanks/')
    context_dict = {'form': form}

    return render_to_response('student_apply.html', context_dict, context)